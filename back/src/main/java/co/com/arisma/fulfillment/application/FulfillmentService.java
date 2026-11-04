package co.com.arisma.fulfillment.application;
import co.com.arisma.fulfillment.application.FulfillmentPorts.*;
import co.com.arisma.fulfillment.domain.DeliveryMethod;
import co.com.arisma.fulfillment.domain.FulfillmentStatus;
import co.com.arisma.fulfillment.domain.Shipment;
import co.com.arisma.sales.application.OrderStatusChanged;
import co.com.arisma.sales.domain.OrderStatus;
import co.com.arisma.shared.domain.NotFound;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import java.time.Clock;
import java.util.*;

/** Delivery use cases. Delivering an order also completes it; cancelling an order stops its delivery. */
@ApplicationScoped
public class FulfillmentService {
    public record BulkResult(int updated, List<Failure> failed) {}
    public record Failure(UUID orderId, String error) {}
    static final int MAX_BULK = 1000;
    @Inject ShipmentRepository shipments;
    @Inject OrderLifecycle orders;
    @Inject FulfillmentService self;
    Clock clock = Clock.systemUTC();

    @Transactional
    public void move(UUID orderId, FulfillmentStatus next, Shipment.Details details, String note, UUID actor) {
        var locked = shipments.lock(orderId).orElseThrow(() -> new NotFound("Pedido no encontrado"));
        var before = locked.shipment();
        var after = before.move(next, details == null ? Shipment.Details.none() : details, locked.order(), clock.instant());
        shipments.save(after, actor);
        shipments.recordEvent(after.id(), before.status(), next, actor, describe(after, note));
        if (next == FulfillmentStatus.DELIVERED) orders.completeOnDelivery(orderId, actor);
    }
    @Transactional
    public void reroute(UUID orderId, DeliveryMethod method, Shipment.Details details, UUID actor) {
        var locked = shipments.lock(orderId).orElseThrow(() -> new NotFound("Pedido no encontrado"));
        var before = locked.shipment();
        var after = before.reroute(method, details == null ? Shipment.Details.none() : details);
        shipments.save(after, actor);
        if (before.method() != after.method()) shipments.recordEvent(after.id(), before.status(), after.status(), actor, "Método cambiado a " + label(after.method()));
    }
    /** Each order in its own transaction so one problem does not stop the rest. */
    public BulkResult moveAll(List<UUID> orderIds, FulfillmentStatus next, String note, UUID actor) {
        if (orderIds == null || orderIds.isEmpty() || orderIds.size() > MAX_BULK || orderIds.stream().anyMatch(Objects::isNull)) throw new IllegalArgumentException("Selecciona entre 1 y " + MAX_BULK + " pedidos");
        if (next == null) throw new IllegalArgumentException("Indica el nuevo estado de entrega");
        int updated = 0; var failed = new ArrayList<Failure>();
        for (UUID id : new LinkedHashSet<>(orderIds)) {
            try { self.moveAlone(id, next, note, actor); updated++; }
            catch (IllegalArgumentException | NotFound e) { failed.add(new Failure(id, e.getMessage())); }
        }
        return new BulkResult(updated, failed);
    }
    /** Public only so the call goes through the CDI proxy and opens its own transaction; use moveAll. */
    @Transactional(Transactional.TxType.REQUIRES_NEW)
    public void moveAlone(UUID orderId, FulfillmentStatus next, String note, UUID actor) { move(orderId, next, Shipment.Details.none(), note, actor); }

    /** Old paid orders that were surely delivered but never marked (WooCommerce history). */
    public BulkResult closeStale(int days, UUID actor) {
        if (days < 30) throw new IllegalArgumentException("Solo se cierran en lote pedidos de hace más de 30 días");
        var ids = shipments.staleOrderIds(days);
        if (ids.isEmpty()) return new BulkResult(0, List.of());
        return moveAll(ids.subList(0, Math.min(ids.size(), MAX_BULK)), FulfillmentStatus.DELIVERED, "Cierre en lote de pedidos de hace más de " + days + " días", actor);
    }

    /** Sales reacts first; the delivery follows: cancelled orders stop, orders completed by hand count as delivered. */
    void onOrderStatus(@Observes OrderStatusChanged event) {
        boolean stops = event.to() == OrderStatus.CANCELLED || event.to() == OrderStatus.FAILED || event.to() == OrderStatus.REFUNDED;
        if (!stops && event.to() != OrderStatus.COMPLETED) return;
        shipments.lock(event.orderId()).ifPresent(locked -> {
            var s = locked.shipment();
            if (stops && s.status() != FulfillmentStatus.DELIVERED && s.status() != FulfillmentStatus.RETURNED && s.status() != FulfillmentStatus.CANCELLED) {
                shipments.save(s.cancel(), event.actor());
                shipments.recordEvent(s.id(), s.status(), FulfillmentStatus.CANCELLED, event.actor(), "Pedido " + event.to().label());
            }
            if (event.to() == OrderStatus.COMPLETED && s.status().open() && s.status() != FulfillmentStatus.FAILED) {
                var delivered = new Shipment(s.id(), s.orderId(), s.method(), FulfillmentStatus.DELIVERED, s.carrier(), s.trackingCode(), s.courierUserId(), s.courierName(), s.recipientName(), s.failureReason(), s.packedAt(), s.shippedAt(), clock.instant());
                shipments.save(delivered, event.actor());
                shipments.recordEvent(s.id(), s.status(), FulfillmentStatus.DELIVERED, event.actor(), "Pedido marcado como completado");
            }
        });
    }
    private static String describe(Shipment s, String note) {
        var parts = new ArrayList<String>();
        if (s.status() == FulfillmentStatus.SHIPPED && s.trackingCode() != null) parts.add(s.carrier() + " · guía " + s.trackingCode());
        if (s.status() == FulfillmentStatus.SHIPPED && s.courierName() != null) parts.add("Lo lleva " + s.courierName());
        if (s.status() == FulfillmentStatus.DELIVERED && s.recipientName() != null) parts.add("Recibió " + s.recipientName());
        if (s.status() == FulfillmentStatus.FAILED) parts.add(s.failureReason());
        if (note != null && !note.isBlank()) parts.add(note.trim());
        return String.join(" · ", parts);
    }
    static String label(DeliveryMethod m) { return switch (m) { case CARRIER -> "transportadora"; case COURIER -> "mensajero propio"; case PICKUP -> "recogida en tienda"; }; }
}

package dev.nortech.norpress.fulfillment.application;
import static org.junit.jupiter.api.Assertions.*;
import dev.nortech.norpress.fulfillment.application.FulfillmentPorts.*;
import dev.nortech.norpress.fulfillment.domain.DeliveryMethod;
import dev.nortech.norpress.fulfillment.domain.FulfillmentStatus;
import dev.nortech.norpress.fulfillment.domain.Shipment;
import dev.nortech.norpress.sales.application.OrderStatusChanged;
import dev.nortech.norpress.sales.domain.OrderStatus;
import dev.nortech.norpress.shared.domain.NotFound;
import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** Delivery use cases with in-memory adapters. */
class FulfillmentServiceTest {
    static class Repo implements ShipmentRepository {
        final Map<UUID, Shipment> byOrder = new HashMap<>(); final Map<UUID, Shipment.OrderState> orders = new HashMap<>(); final List<String> events = new ArrayList<>();
        public Optional<Locked> lock(UUID orderId) { return Optional.ofNullable(byOrder.get(orderId)).map(s -> new Locked(s, orders.get(orderId))); }
        public void save(Shipment s, UUID actor) { byOrder.put(s.orderId(), s); }
        public void recordEvent(UUID id, FulfillmentStatus from, FulfillmentStatus to, UUID actor, String note) { events.add(from + ">" + to); }
        final Map<UUID, String> carrierCodes = new HashMap<>(); final Map<UUID, Boolean> follows = new HashMap<>();
        public void setCarrier(UUID shipmentId, String code, boolean follow) { carrierCodes.put(shipmentId, code); follows.put(shipmentId, follow); }
        public List<UUID> staleOrderIds(int days) { return byOrder.values().stream().filter(s -> s.status() == FulfillmentStatus.PENDING).map(Shipment::orderId).toList(); }
    }
    static class Lifecycle implements OrderLifecycle { final List<UUID> completed = new ArrayList<>(); public void completeOnDelivery(UUID id, UUID actor) { completed.add(id); } }
    Repo repo; Lifecycle lifecycle; FulfillmentService service;
    @BeforeEach void setUp() { repo = new Repo(); lifecycle = new Lifecycle(); service = new FulfillmentService(); service.shipments = repo; service.carriers = new TestCarriers.Catalog(); service.orders = lifecycle; service.self = service; service.moved = moved; }
    final Moved moved = new Moved();
    /** Collects fired delivery events instead of notifying observers. */
    static class Moved implements jakarta.enterprise.event.Event<ShipmentMoved> {
        final List<ShipmentMoved> fired = new ArrayList<>();
        public void fire(ShipmentMoved e) { fired.add(e); }
        public <U extends ShipmentMoved> java.util.concurrent.CompletionStage<U> fireAsync(U e) { fired.add(e); return java.util.concurrent.CompletableFuture.completedFuture(e); }
        public <U extends ShipmentMoved> java.util.concurrent.CompletionStage<U> fireAsync(U e, jakarta.enterprise.event.NotificationOptions o) { return fireAsync(e); }
        public jakarta.enterprise.event.Event<ShipmentMoved> select(java.lang.annotation.Annotation... q) { return this; }
        public <U extends ShipmentMoved> jakarta.enterprise.event.Event<U> select(Class<U> t, java.lang.annotation.Annotation... q) { throw new UnsupportedOperationException(); }
        public <U extends ShipmentMoved> jakarta.enterprise.event.Event<U> select(jakarta.enterprise.util.TypeLiteral<U> t, java.lang.annotation.Annotation... q) { throw new UnsupportedOperationException(); }
    }
    UUID order(DeliveryMethod m, FulfillmentStatus s, Shipment.OrderState state) {
        var id = UUID.randomUUID(); repo.byOrder.put(id, new Shipment(UUID.randomUUID(), id, m, s, null, null, null, null, null, null, null, null, null)); repo.orders.put(id, state); return id;
    }
    static final Shipment.OrderState PAID = new Shipment.OrderState(true, false, false), UNPAID = new Shipment.OrderState(false, false, false);

    @Test void shippingWithACarrierOfTheListStoresItsNameTheNumberAndTheChoice() {
        var id = order(DeliveryMethod.CARRIER, FulfillmentStatus.PACKED, PAID);
        service.move(id, FulfillmentStatus.SHIPPED, new Shipment.Details(null, " 1234 5678 901 ", null, null, null, null), new FulfillmentService.Dispatch("coordinadora", false), null, null);
        var s = repo.byOrder.get(id);
        assertEquals("Coordinadora", s.carrier());
        assertEquals("12345678901", s.trackingCode());
        assertEquals("coordinadora", repo.carrierCodes.get(s.id()));
        assertEquals(false, repo.follows.get(s.id()), "link only: not followed automatically");
    }
    @Test void aCarrierOffTheListOrABadNumberIsRefused() {
        var id = order(DeliveryMethod.CARRIER, FulfillmentStatus.PACKED, PAID);
        assertThrows(IllegalArgumentException.class, () -> service.move(id, FulfillmentStatus.SHIPPED, new Shipment.Details(null, "12345678901", null, null, null, null), new FulfillmentService.Dispatch("viejo", true), null, null));
        assertThrows(IllegalArgumentException.class, () -> service.move(id, FulfillmentStatus.SHIPPED, new Shipment.Details(null, "12", null, null, null, null), new FulfillmentService.Dispatch("coordinadora", true), null, null));
        // typed by hand: a known name still finds its carrier; an unknown one is kept as typed
        service.move(id, FulfillmentStatus.SHIPPED, new Shipment.Details("Mensajería del Barrio", "MB-2024-001", null, null, null, null), null, null);
        assertEquals("Mensajería del Barrio", repo.byOrder.get(id).carrier());
        assertNull(repo.carrierCodes.get(repo.byOrder.get(id).id()));
    }
    @Test void theShopperLinkComesFromTheCarrier() {
        assertEquals("https://coordinadora.com/rastreo/rastreo-de-guia/detalle-de-rastreo-de-guia/?guia=12345678901", service.trackingLink("coordinadora", "12345678901"));
        assertEquals("https://www.interrapidisimo.com/", service.trackingLink("Interrapidísimo", "700123"));
        assertNull(service.trackingLink("Desconocida", "1234"));
    }
    @Test void deliveringCompletesTheOrder() {
        var id = order(DeliveryMethod.PICKUP, FulfillmentStatus.PACKED, PAID);
        service.move(id, FulfillmentStatus.DELIVERED, new Shipment.Details(null, null, null, null, "Ana", null), "", null);
        assertEquals(List.of(id), lifecycle.completed);
        assertEquals(List.of("PACKED>DELIVERED"), repo.events);
    }
    @Test void packingDoesNotTouchTheOrder() {
        var id = order(DeliveryMethod.CARRIER, FulfillmentStatus.PENDING, PAID);
        service.move(id, FulfillmentStatus.PACKED, null, null, null);
        assertTrue(lifecycle.completed.isEmpty());
        assertEquals(FulfillmentStatus.PACKED, repo.byOrder.get(id).status());
    }
    @Test void cancelledOrderStopsDelivery() {
        var id = order(DeliveryMethod.CARRIER, FulfillmentStatus.PACKED, PAID);
        service.onOrderStatus(new OrderStatusChanged(id, OrderStatus.PROCESSING, OrderStatus.CANCELLED, null));
        assertEquals(FulfillmentStatus.CANCELLED, repo.byOrder.get(id).status());
    }
    @Test void orderCompletedByHandCountsAsDelivered() {
        var id = order(DeliveryMethod.CARRIER, FulfillmentStatus.PENDING, PAID);
        service.onOrderStatus(new OrderStatusChanged(id, OrderStatus.PROCESSING, OrderStatus.COMPLETED, null));
        assertEquals(FulfillmentStatus.DELIVERED, repo.byOrder.get(id).status());
        assertNotNull(repo.byOrder.get(id).deliveredAt());
    }
    @Test void bulkReportsEachFailure() {
        UUID ok = order(DeliveryMethod.CARRIER, FulfillmentStatus.PENDING, PAID), unpaid = order(DeliveryMethod.CARRIER, FulfillmentStatus.PENDING, UNPAID);
        var r = service.moveAll(List.of(ok, unpaid, UUID.randomUUID()), FulfillmentStatus.DELIVERED, "", null);
        assertEquals(1, r.updated()); assertEquals(2, r.failed().size());
    }
    @Test void closeStaleOnlyForOldOrders() {
        assertThrows(IllegalArgumentException.class, () -> service.closeStale(7, null));
        order(DeliveryMethod.CARRIER, FulfillmentStatus.PENDING, PAID); order(DeliveryMethod.PICKUP, FulfillmentStatus.PENDING, PAID);
        assertEquals(2, service.closeStale(60, null).updated());
    }
    @Test void missingOrder() { assertThrows(NotFound.class, () -> service.move(UUID.randomUUID(), FulfillmentStatus.PACKED, null, null, null)); }
}

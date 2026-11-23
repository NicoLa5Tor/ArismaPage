package co.com.arisma.fulfillment.application;
import static org.junit.jupiter.api.Assertions.*;
import co.com.arisma.fulfillment.application.FulfillmentPorts.*;
import co.com.arisma.fulfillment.domain.DeliveryMethod;
import co.com.arisma.fulfillment.domain.FulfillmentStatus;
import co.com.arisma.fulfillment.domain.Shipment;
import co.com.arisma.sales.application.OrderStatusChanged;
import co.com.arisma.sales.domain.OrderStatus;
import co.com.arisma.shared.domain.NotFound;
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
        public List<UUID> staleOrderIds(int days) { return byOrder.values().stream().filter(s -> s.status() == FulfillmentStatus.PENDING).map(Shipment::orderId).toList(); }
    }
    static class Lifecycle implements OrderLifecycle { final List<UUID> completed = new ArrayList<>(); public void completeOnDelivery(UUID id, UUID actor) { completed.add(id); } }
    Repo repo; Lifecycle lifecycle; FulfillmentService service;
    @BeforeEach void setUp() { repo = new Repo(); lifecycle = new Lifecycle(); service = new FulfillmentService(); service.shipments = repo; service.orders = lifecycle; service.self = service; service.moved = moved; }
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

package dev.nortech.norpress.sales.application;
import static org.junit.jupiter.api.Assertions.*;
import dev.nortech.norpress.inventory.application.StockLedger;
import dev.nortech.norpress.sales.domain.OrderStatus;
import dev.nortech.norpress.shared.domain.NotFound;
import java.util.*;
import java.lang.annotation.Annotation;
import jakarta.enterprise.event.Event;
import jakarta.enterprise.event.NotificationOptions;
import jakarta.enterprise.util.TypeLiteral;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.CompletableFuture;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** Use-case tests with in-memory adapters: no database, no Quarkus. */
class OrderServiceTest {
    static class FakeOrders implements OrderRepository {
        final Map<UUID, OrderRef> orders = new HashMap<>(); final Map<UUID, List<ReducedLine>> lines = new HashMap<>();
        final List<String> history = new ArrayList<>(); final Set<UUID> returned = new HashSet<>();
        public Optional<OrderRef> lock(UUID id) { return Optional.ofNullable(orders.get(id)); }
        public void moveTo(UUID id, OrderStatus next) { var o = orders.get(id); orders.put(id, new OrderRef(id, o.number(), next)); }
        public void recordHistory(UUID id, OrderStatus from, OrderStatus to, UUID actor, String note) { history.add(from + ">" + to); }
        public void keepActive(UUID id, boolean active) { }
        public List<ReducedLine> lockReducedLines(UUID id) { return lines.getOrDefault(id, List.of()).stream().filter(l -> !returned.contains(l.lineId())).toList(); }
        public void markReturned(UUID lineId) { returned.add(lineId); }
        public void markReduced(UUID lineId, int quantity) {}
        public Map<String, Object> addNote(UUID id, String body, UUID actor) { return Map.of("body", body); }
    }
    static class FakeLedger implements StockLedger {
        final Map<UUID, Integer> returned = new HashMap<>();
        public void returnToStock(UUID productId, int quantity, UUID orderLineId, String reason, UUID actor) { returned.merge(productId, quantity, Integer::sum); }
        public void recordManualChange(UUID productId, Integer before, Integer after, String reason, UUID actor) {}
        public int takeForSale(UUID productId, int quantity, UUID orderLineId, String reason) { return quantity; }
    }
    /** Collects fired events instead of notifying observers. */
    static class Events implements Event<OrderStatusChanged> {
        final List<OrderStatusChanged> fired = new ArrayList<>();
        public void fire(OrderStatusChanged e) { fired.add(e); }
        public <U extends OrderStatusChanged> CompletionStage<U> fireAsync(U e) { fired.add(e); return CompletableFuture.completedFuture(e); }
        public <U extends OrderStatusChanged> CompletionStage<U> fireAsync(U e, NotificationOptions o) { return fireAsync(e); }
        public Event<OrderStatusChanged> select(Annotation... q) { return this; }
        public <U extends OrderStatusChanged> Event<U> select(Class<U> t, Annotation... q) { throw new UnsupportedOperationException(); }
        public <U extends OrderStatusChanged> Event<U> select(TypeLiteral<U> t, Annotation... q) { throw new UnsupportedOperationException(); }
    }
    FakeOrders orders; FakeLedger ledger; OrderService service; Events events;
    final UUID product = UUID.randomUUID();

    @BeforeEach void setUp() {
        orders = new FakeOrders(); ledger = new FakeLedger(); service = new OrderService();
        service.orders = orders; service.stock = ledger; service.self = service; events = new Events(); service.events = events;
    }
    UUID order(OrderStatus status, int reduced) {
        var id = UUID.randomUUID(); orders.orders.put(id, new OrderRepository.OrderRef(id, "100", status));
        if (reduced > 0) orders.lines.put(id, List.of(new OrderRepository.ReducedLine(UUID.randomUUID(), product, reduced)));
        return id;
    }

    @Test void completingRecordsHistoryWithoutTouchingStock() {
        var id = order(OrderStatus.PROCESSING, 2);
        service.changeStatus(id, OrderStatus.COMPLETED, "Entregado", null);
        assertEquals(OrderStatus.COMPLETED, orders.orders.get(id).status());
        assertEquals(List.of("PROCESSING>COMPLETED"), orders.history);
        assertTrue(ledger.returned.isEmpty());
    }
    @Test void cancellingReturnsStockOnce() {
        var id = order(OrderStatus.PROCESSING, 2);
        service.changeStatus(id, OrderStatus.CANCELLED, null, null);
        assertEquals(2, ledger.returned.get(product));
        // its money coming back later makes it refunded, without returning the units a second time
        service.changeStatus(id, OrderStatus.REFUNDED, null, null);
        assertEquals(2, ledger.returned.get(product));
    }
    @Test void invalidTransitionChangesNothing() {
        var id = order(OrderStatus.COMPLETED, 0);
        assertThrows(IllegalArgumentException.class, () -> service.changeStatus(id, OrderStatus.PROCESSING, null, null));
        assertEquals(OrderStatus.COMPLETED, orders.orders.get(id).status());
        assertTrue(orders.history.isEmpty());
    }
    @Test void missingOrder() { assertThrows(NotFound.class, () -> service.changeStatus(UUID.randomUUID(), OrderStatus.COMPLETED, null, null)); }
    @Test void bulkReportsEachFailure() {
        var ok = order(OrderStatus.PROCESSING, 0); var done = order(OrderStatus.COMPLETED, 0); var missing = UUID.randomUUID();
        var result = service.changeStatuses(List.of(ok, done, missing, ok), OrderStatus.COMPLETED, "", null);
        assertEquals(1, result.updated());
        assertEquals(Set.of(done, missing), new HashSet<>(result.failed().stream().map(OrderService.Failure::id).toList()));
    }
    @Test void bulkLimits() {
        assertThrows(IllegalArgumentException.class, () -> service.changeStatuses(List.of(), OrderStatus.COMPLETED, "", null));
        assertThrows(IllegalArgumentException.class, () -> service.changeStatuses(Collections.nCopies(201, UUID.randomUUID()), OrderStatus.COMPLETED, "", null));
    }
    @Test void notesAreValidated() {
        var id = order(OrderStatus.PROCESSING, 0);
        assertThrows(IllegalArgumentException.class, () -> service.addNote(id, " ", null));
        assertEquals("Llamar", service.addNote(id, " Llamar ", null).get("body"));
    }
    @Test void statusChangesAreAnnounced() {
        var id = order(OrderStatus.PROCESSING, 0);
        service.changeStatus(id, OrderStatus.COMPLETED, "", null);
        assertEquals(new OrderStatusChanged(id, OrderStatus.PROCESSING, OrderStatus.COMPLETED, null), events.fired.get(0));
    }
    @Test void deliveryCompletesThroughProcessing() {
        var cod = order(OrderStatus.PENDING, 0);
        service.completeOnDelivery(cod, null);
        assertEquals(OrderStatus.COMPLETED, orders.orders.get(cod).status());
        assertEquals(List.of("PENDING>PROCESSING", "PROCESSING>COMPLETED"), orders.history);
        var cancelled = order(OrderStatus.CANCELLED, 0);
        service.completeOnDelivery(cancelled, null);
        assertEquals(OrderStatus.CANCELLED, orders.orders.get(cancelled).status());
    }
}

package dev.nortech.norpress.sales.domain;
import static org.junit.jupiter.api.Assertions.*;
import org.junit.jupiter.api.Test;
class OrderStatusTest {
    @Test void processingCanBeClosedOrCancelled() {
        assertTrue(OrderStatus.PROCESSING.canMoveTo(OrderStatus.COMPLETED));
        assertTrue(OrderStatus.PROCESSING.canMoveTo(OrderStatus.CANCELLED));
        assertFalse(OrderStatus.CANCELLED.canMoveTo(OrderStatus.PROCESSING));
        assertFalse(OrderStatus.COMPLETED.canMoveTo(OrderStatus.PROCESSING));
        assertThrows(IllegalArgumentException.class, () -> OrderStatus.REFUNDED.requireMoveTo(OrderStatus.COMPLETED));
    }
    @Test void paidStatusesMatchReports() {
        assertTrue(OrderStatus.PROCESSING.paid()); assertTrue(OrderStatus.COMPLETED.paid()); assertTrue(OrderStatus.ON_HOLD.paid());
        assertFalse(OrderStatus.PENDING.paid()); assertFalse(OrderStatus.FAILED.paid()); assertFalse(OrderStatus.CANCELLED.paid());
    }
    @Test void dbNamesRoundTrip() { for (var s : OrderStatus.values()) assertEquals(s, OrderStatus.fromDb(s.db())); }
}

package dev.nortech.norpress.sales.domain;
import org.junit.jupiter.api.Test;
import java.time.Instant;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

/** The shopper's view of an order's history: their steps, in order, without the store's own work. */
class OrderJourneyTest {
    static OrderJourney.Change c(String source, String from, String to, String at) { return new OrderJourney.Change(source, from, to, Instant.parse(at)); }

    @Test void aShippedOrderShowsEveryStepAndHidesTheStoreWork() {
        // a real order's recorded changes, shuffled: method changes and the invoice note are internal (same status)
        var steps = OrderJourney.of(List.of(
            c("order", "processing", "completed", "2026-11-23T03:36:25Z"),
            c("order", null, "pending", "2026-11-23T00:06:21Z"),
            c("order", "pending", "processing", "2026-11-23T00:41:04Z"),
            c("order", "processing", "processing", "2026-11-23T00:41:46Z"),
            c("shipment", "pending", "pending", "2026-11-23T00:58:55Z"),
            c("shipment", "pending", "packed", "2026-11-23T01:07:10Z"),
            c("shipment", "packed", "packed", "2026-11-23T01:07:17Z"),
            c("invoice", null, "sent", "2026-11-23T01:10:00Z"),
            c("shipment", "packed", "shipped", "2026-11-23T03:36:12Z"),
            c("shipment", "shipped", "delivered", "2026-11-23T03:36:25Z")),
            new OrderJourney.Delivery("carrier", "Coordinadora", "123456"));
        assertEquals(List.of("Recibimos tu pedido", "Pago confirmado", "Empacamos tu pedido", "Tu factura está lista", "Salió con Coordinadora", "Entregado"),
            steps.stream().map(OrderJourney.Step::title).toList());
        assertEquals("Guía 123456", steps.get(4).detail());
        assertEquals("Entregado", OrderJourney.latest(steps).title());
    }

    @Test void pickupIsWordedAsPickup() {
        var steps = OrderJourney.of(List.of(c("shipment", "pending", "packed", "2026-01-01T10:00:00Z"), c("shipment", "packed", "delivered", "2026-01-01T12:00:00Z")),
            new OrderJourney.Delivery("pickup", null, null));
        assertEquals(List.of("Listo para recoger en la tienda", "Recogiste tu pedido"), steps.stream().map(OrderJourney.Step::title).toList());
    }

    @Test void aStepUndoneAndRedoneShowsOnce() {
        var steps = OrderJourney.of(List.of(
            c("shipment", "pending", "packed", "2026-01-01T10:00:00Z"),
            c("shipment", "packed", "pending", "2026-01-01T10:05:00Z"),
            c("shipment", "pending", "packed", "2026-01-01T10:10:00Z")), new OrderJourney.Delivery("courier", null, null));
        assertEquals(1, steps.size());
        assertEquals(Instant.parse("2026-01-01T10:00:00Z"), steps.getFirst().at());
    }

    @Test void aCompletedOrderWithoutDeliveryStepsSaysCompleted() {
        var steps = OrderJourney.of(List.of(c("order", null, "pending", "2026-01-01T10:00:00Z"), c("order", "pending", "processing", "2026-01-01T10:01:00Z"), c("order", "processing", "completed", "2026-01-02T10:00:00Z")), OrderJourney.Delivery.NONE);
        assertEquals("Pedido completado", OrderJourney.latest(steps).title());
    }

    @Test void theLastRefundComesBeforeTheOrderIsRefunded() {
        var steps = OrderJourney.of(List.of(
            c("order", "processing", "cancelled", "2026-01-01T10:00:00Z"),
            c("order", "cancelled", "refunded", "2026-01-01T11:00:00Z"),
            new OrderJourney.Change("refund", null, "done", Instant.parse("2026-01-01T11:00:00Z"), "$ 50.000 por transferencia")),
            OrderJourney.Delivery.NONE);
        assertEquals(List.of("Pedido cancelado", "Te devolvimos dinero", "Te devolvimos todo el dinero"), steps.stream().map(OrderJourney.Step::title).toList());
        assertEquals("$ 50.000 por transferencia", steps.get(1).detail());
    }
}

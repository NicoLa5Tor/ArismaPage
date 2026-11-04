package co.com.arisma.fulfillment.domain;
import static org.junit.jupiter.api.Assertions.*;
import co.com.arisma.fulfillment.domain.Shipment.Details;
import co.com.arisma.fulfillment.domain.Shipment.OrderState;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
class ShipmentTest {
    static final Instant NOW = Instant.parse("2026-11-04T15:00:00Z");
    static final OrderState PAID = new OrderState(true, false, false), UNPAID = new OrderState(false, false, false), COD = new OrderState(false, true, false), CLOSED = new OrderState(true, false, true);
    static Shipment shipment(DeliveryMethod m, FulfillmentStatus s) { return new Shipment(UUID.randomUUID(), UUID.randomUUID(), m, s, null, null, null, null, null, null, null, null, null); }
    static Details guide(String carrier, String code) { return new Details(carrier, code, null, null, null, null); }

    @Test void carrierNeedsTrackingNumber() {
        var s = shipment(DeliveryMethod.CARRIER, FulfillmentStatus.PACKED);
        assertThrows(IllegalArgumentException.class, () -> s.move(FulfillmentStatus.SHIPPED, Details.none(), PAID, NOW));
        var shipped = s.move(FulfillmentStatus.SHIPPED, guide("Servientrega", "123"), PAID, NOW);
        assertEquals("123", shipped.trackingCode()); assertEquals(NOW, shipped.shippedAt());
    }
    @Test void courierNeedsSomeone() {
        var s = shipment(DeliveryMethod.COURIER, FulfillmentStatus.PENDING);
        assertThrows(IllegalArgumentException.class, () -> s.move(FulfillmentStatus.SHIPPED, Details.none(), PAID, NOW));
        assertEquals("Carlos", s.move(FulfillmentStatus.SHIPPED, new Details(null, null, null, "Carlos", null, null), PAID, NOW).courierName());
    }
    @Test void pickupIsNeverShipped() {
        var s = shipment(DeliveryMethod.PICKUP, FulfillmentStatus.PACKED);
        assertThrows(IllegalArgumentException.class, () -> s.move(FulfillmentStatus.SHIPPED, guide("x", "1"), PAID, NOW));
        assertEquals("Marta", s.move(FulfillmentStatus.DELIVERED, new Details(null, null, null, null, "Marta", null), PAID, NOW).recipientName());
    }
    @Test void unpaidOrdersDoNotLeaveUnlessCashOnDelivery() {
        var s = shipment(DeliveryMethod.CARRIER, FulfillmentStatus.PACKED);
        assertThrows(IllegalArgumentException.class, () -> s.move(FulfillmentStatus.SHIPPED, guide("Envía", "9"), UNPAID, NOW));
        assertDoesNotThrow(() -> s.move(FulfillmentStatus.SHIPPED, guide("Envía", "9"), COD, NOW));
        assertDoesNotThrow(() -> s.move(FulfillmentStatus.PENDING, Details.none(), UNPAID, NOW), "packing back and forth does not need payment");
        assertThrows(IllegalArgumentException.class, () -> s.move(FulfillmentStatus.SHIPPED, guide("Envía", "9"), CLOSED, NOW));
    }
    @Test void failureNeedsReasonAndCanBeRetried() {
        var shipped = shipment(DeliveryMethod.CARRIER, FulfillmentStatus.PACKED).move(FulfillmentStatus.SHIPPED, guide("TCC", "77"), PAID, NOW);
        assertThrows(IllegalArgumentException.class, () -> shipped.move(FulfillmentStatus.FAILED, Details.none(), PAID, NOW));
        var failed = shipped.move(FulfillmentStatus.FAILED, new Details(null, null, null, null, null, "No había nadie"), PAID, NOW);
        assertEquals("No había nadie", failed.failureReason());
        var retried = failed.move(FulfillmentStatus.SHIPPED, Details.none(), PAID, NOW);
        assertEquals("77", retried.trackingCode(), "retry keeps the tracking number");
        assertNull(retried.failureReason());
    }
    @Test void deliveredIsFinal() {
        var d = shipment(DeliveryMethod.CARRIER, FulfillmentStatus.PENDING).move(FulfillmentStatus.DELIVERED, Details.none(), PAID, NOW);
        assertThrows(IllegalArgumentException.class, () -> d.move(FulfillmentStatus.FAILED, new Details(null, null, null, null, null, "x"), PAID, NOW));
        assertThrows(IllegalArgumentException.class, () -> d.reroute(DeliveryMethod.PICKUP, Details.none()));
    }
    @Test void rerouteToPickupClearsCarrierData() {
        var s = new Shipment(UUID.randomUUID(), UUID.randomUUID(), DeliveryMethod.CARRIER, FulfillmentStatus.PACKED, "Servientrega", "1", null, null, null, null, null, null, null);
        var r = s.reroute(DeliveryMethod.PICKUP, Details.none());
        assertEquals(DeliveryMethod.PICKUP, r.method()); assertNull(r.trackingCode());
    }
}

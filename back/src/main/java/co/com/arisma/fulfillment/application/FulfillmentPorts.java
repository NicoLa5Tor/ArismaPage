package co.com.arisma.fulfillment.application;
import co.com.arisma.fulfillment.domain.DeliveryMethod;
import co.com.arisma.fulfillment.domain.FulfillmentStatus;
import co.com.arisma.fulfillment.domain.Shipment;
import java.util.*;

public final class FulfillmentPorts {
    private FulfillmentPorts() {}
    public record Locked(Shipment shipment, Shipment.OrderState order) {}

    /** Write side; lock creates the shipment on first use, from the order's chosen shipping method. */
    public interface ShipmentRepository {
        Optional<Locked> lock(UUID orderId);
        void save(Shipment shipment, UUID actor);
        void recordEvent(UUID shipmentId, FulfillmentStatus from, FulfillmentStatus to, UUID actor, String note);
        /** Paid orders older than the given days whose delivery was never recorded (mostly WooCommerce history). */
        List<UUID> staleOrderIds(int days);
    }
    /** Read side for the dispatch board and the order's delivery tab. */
    public interface FulfillmentQueries {
        Map<String, Object> board(DeliveryMethod method, String query, int staleDays);
        Optional<Map<String, Object>> shipment(UUID orderId);
        /** Active panel users who can take a delivery. */
        List<Map<String, Object>> couriers();
    }
    /** What deliveries need from sales: closing the order once it is handed over. */
    public interface OrderLifecycle {
        void completeOnDelivery(UUID orderId, UUID actor);
    }
}

package dev.nortech.norpress.fulfillment.application;
import dev.nortech.norpress.fulfillment.domain.DeliveryMethod;
import dev.nortech.norpress.fulfillment.domain.FulfillmentStatus;
import dev.nortech.norpress.fulfillment.domain.Shipment;
import java.util.*;

public final class FulfillmentPorts {
    private FulfillmentPorts() {}
    public record Locked(Shipment shipment, Shipment.OrderState order) {}

    /** Write side; lock creates the shipment on first use, from the order's chosen shipping method. */
    public interface ShipmentRepository {
        Optional<Locked> lock(UUID orderId);
        void save(Shipment shipment, UUID actor);
        void recordEvent(UUID shipmentId, FulfillmentStatus from, FulfillmentStatus to, UUID actor, String note);
        /** The carrier picked from the store's list (null: one typed by hand) and whether its guide is followed automatically. */
        void setCarrier(UUID shipmentId, String carrierCode, boolean follow);
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
    /** The carriers the store ships with (Tienda → Envíos), in the order the team sees them. */
    public interface CarrierCatalog {
        List<dev.nortech.norpress.fulfillment.domain.Carrier> all();
        Optional<dev.nortech.norpress.fulfillment.domain.Carrier> find(String code);
        /** Inserts or replaces it by code. */
        void save(dev.nortech.norpress.fulfillment.domain.Carrier carrier);
        /** The carrier a typed name refers to, if it is one of the list. */
        default Optional<dev.nortech.norpress.fulfillment.domain.Carrier> match(String typed) { return all().stream().filter(c -> c.matches(typed)).findFirst(); }
    }
    /** What deliveries need from sales: closing the order once it is handed over. */
    public interface OrderLifecycle {
        void completeOnDelivery(UUID orderId, UUID actor);
    }
}

package co.com.arisma.fulfillment.application;
import co.com.arisma.fulfillment.domain.FulfillmentStatus;
import java.util.UUID;

/** Fired inside the same transaction whenever a delivery changes status, so other modules (emails) can react without fulfillment knowing them. */
public record ShipmentMoved(UUID orderId, FulfillmentStatus to, String carrier, String trackingCode) {}

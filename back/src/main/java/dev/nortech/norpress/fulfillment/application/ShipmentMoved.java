package dev.nortech.norpress.fulfillment.application;
import dev.nortech.norpress.fulfillment.domain.FulfillmentStatus;
import java.util.UUID;

/** Fired inside the same transaction whenever a delivery changes status, so other modules (emails) can react without fulfillment knowing them. */
/** pickup: the shopper collects it at the shop. tell: the shopper is told (not when old orders are closed in bulk). */
public record ShipmentMoved(UUID orderId, FulfillmentStatus to, String carrier, String trackingCode, boolean pickup, boolean tell) {}

package dev.nortech.norpress.fulfillment.application;
import io.smallrye.mutiny.Multi;
import java.util.UUID;

/**
 * What changed in orders and their delivery, as it happens, for the screens that are open (the panel, the shopper's
 * order page). It says only which order changed and what kind of change: each screen fetches the data again with its
 * own access rules, so nothing private travels through the feed.
 */
public interface ShipmentFeed {
    /** kind: "order" (status or payment), "shipment" (a delivery step) or "tracking" (the carrier reported). */
    record Change(UUID orderId, String kind) {}

    void publish(Change change);
    /** Every change from now on, for as long as the subscriber listens. */
    Multi<Change> changes();
}

package dev.nortech.norpress.inventory.application;
import java.util.UUID;

/** Inventory module API used by other modules. Every stock change is recorded with its reason. */
public interface StockLedger {
    /** Puts units back on the shelf (when the product tracks stock) and records a cancel movement linked to the order line. */
    void returnToStock(UUID productId, int quantity, UUID orderLineId, String reason, UUID actor);
    /**
     * Takes units off the shelf for an order line and records a sale movement. Products that do not track stock only get
     * the movement. Returns how many units were really reduced (what a cancellation must give back).
     * Refuses when tracked stock is short and the product does not take backorders.
     */
    int takeForSale(UUID productId, int quantity, UUID orderLineId, String reason);
    /** Records an administrator's stock edit; the product row itself is saved by the catalog. */
    void recordManualChange(UUID productId, Integer before, Integer after, String reason, UUID actor);
}

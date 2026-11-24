package dev.nortech.norpress.sales.application;
import java.util.UUID;

/** What other modules may ask about a customer's purchases. Test orders never count. */
public interface PurchaseHistory {
    /** A paid order of this customer includes the product. */
    boolean purchased(UUID customerId, UUID productId);
}

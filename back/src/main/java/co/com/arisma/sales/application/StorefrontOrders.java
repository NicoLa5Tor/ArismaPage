package co.com.arisma.sales.application;
import co.com.arisma.sales.domain.OrderStatus;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/** What the store itself needs from orders: the shopper's view of one order and the facts a payment works with. */
public interface StorefrontOrders {
    /** An order as a payment sees it. taxBase is the tax-exclusive value of the lines that carry tax; billing and shipping use the stored keys (first_name, address_1...). */
    record Payable(UUID id, String number, OrderStatus status, boolean test, BigDecimal total, BigDecimal tax, BigDecimal taxBase, String paymentMethod, Map<String, String> billing, Map<String, String> shipping, Instant expiresAt) {
        public String email() { return billing.getOrDefault("email", ""); }
        public String buyerName() { return (billing.getOrDefault("first_name", "") + " " + billing.getOrDefault("last_name", "")).trim(); }
    }
    /**
     * Who may open an order: whoever holds the secret key it was placed with, the account that placed it, or the
     * customer behind a verified account (that also reaches the orders of the old store made with that email).
     */
    record Access(String number, String keyHash, UUID accountId, UUID customerId) {
        public static Access byKey(String number, String keyHash) { return new Access(number, keyHash, null, null); }
        public static Access byAccount(String number, UUID accountId, UUID verifiedCustomerId) { return new Access(number, null, accountId, verifiedCustomerId); }
        public boolean owned() { return keyHash == null; }
    }
    Optional<Payable> payable(Access access);
    Optional<Payable> payable(UUID id);
    /** The order page: status, stage, lines with photos, totals and delivery. No internal notes. */
    Optional<Map<String, Object>> view(Access access);
    /** The orders of an account, newest first: those it placed and, with a verified email, every one of its customer. */
    List<Map<String, Object>> owned(UUID accountId, UUID verifiedCustomerId, int limit, int offset);
    void recordPayment(UUID orderId, String provider, String externalId, String paymentType, BigDecimal amount, Instant paidAt, String sourceKey);
    void setPaymentMethod(UUID orderId, String method, String title);
}

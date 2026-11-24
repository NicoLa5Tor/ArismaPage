package dev.nortech.norpress.sales.application;
import dev.nortech.norpress.sales.domain.AfterSale;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Cancellation requests, refunds and refund accounts of an order. Callers run inside a transaction. */
public interface AfterSaleRepository {
    /**
     * What the rules need to know about the order: its stage, what was paid (0 when unpaid), what was given back
     * (refunds done) and what is on its way back (refunds in progress), and who to tell.
     */
    record Standing(UUID id, String number, String stage, BigDecimal paid, BigDecimal refunded, BigDecimal inProgress, boolean migrated, String email, String name) {
        public BigDecimal left() { return paid.subtract(refunded).subtract(inProgress).max(BigDecimal.ZERO); }
    }
    record Request(UUID id, String reason, String status) {}
    /** route: manual, wompi, payu, transfer; status: processing, checking, to_transfer, succeeded. */
    record RefundRow(UUID id, UUID orderId, BigDecimal amount, String route, String status, String gatewayReference, String failure, Instant sentAt, Instant createdAt) {}

    Optional<Standing> standing(UUID orderId);
    Optional<Request> openRequest(UUID orderId);
    void insertRequest(UUID orderId, String reason);
    void decide(UUID requestId, boolean approved, String answer, UUID actor);
    /** A refund the store already made itself: recorded as done. */
    void insertRefund(UUID orderId, AfterSale.Refund refund, UUID actor);
    /** A refund to make: through a gateway (processing) or by transfer (to_transfer). */
    UUID insertPending(UUID orderId, BigDecimal amount, String route, String status, String requestedBy, UUID actor);
    /** The refund, locked. */
    Optional<RefundRow> refund(UUID refundId);
    Optional<RefundRow> openRefund(UUID orderId);
    /** Marks it as handed to the gateway: from here on it is never sent again. False when it already was. */
    boolean claim(UUID refundId);
    void update(UUID refundId, String status, String gatewayReference, String failure);
    void complete(UUID refundId, String method, String reference, UUID actor);
    /** Refunds waiting for the gateway: never sent yet, or left pending by it. */
    List<RefundRow> pending(int limit);
    void savePayout(UUID orderId, String sealed);
    Optional<String> payout(UUID orderId);
    void deletePayout(UUID orderId);
}

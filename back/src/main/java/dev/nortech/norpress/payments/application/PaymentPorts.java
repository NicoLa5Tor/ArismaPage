package dev.nortech.norpress.payments.application;
import dev.nortech.norpress.payments.domain.PaymentState;
import java.math.BigDecimal;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/** Ports of the payments module. */
public final class PaymentPorts {
    private PaymentPorts() {}

    /** `detail`: what the gateway said about the last result (empty while there is nothing to say). */
    public record Attempt(String reference, UUID orderId, String gateway, BigDecimal amount, boolean sandbox, PaymentState status, String detail) {}
    public interface AttemptRepository {
        void insert(Attempt attempt);
        Optional<Attempt> find(String reference);
        Optional<Attempt> latest(UUID orderId);
        /** Tries at a gateway still waiting for an answer, started after `since`, on orders still waiting for payment. */
        java.util.List<Attempt> open(String gateway, java.time.Instant since, int limit);
        /** Orders still waiting for payment whose latest try the gateway is processing, with a time to pay that ran out after `since`. */
        java.util.Set<UUID> waiting(java.time.Instant since);
        /** True only for the call that moves the try to approved: the one that may mark the order as paid. */
        boolean approve(String reference, String externalId, String detail);
        /** Updates a try that is not approved; an approved one never goes back. */
        void update(String reference, PaymentState status, String externalId, String detail);
        /** The approved try of an order: what a refund goes back through. */
        Optional<Approved> approved(UUID orderId);
    }
    /** An approved try: the gateway's id of the charge, how it was paid (CARD, NEQUI, VISA…) and when. */
    public record Approved(String reference, String gateway, boolean sandbox, String externalId, String paymentType, java.time.Instant at) {}

    /**
     * A gateway's answer to a refund. outcome: APPROVED, PENDING, DECLINED, UNKNOWN (no answer: it may have happened).
     * id: the gateway's reference to ask about it later (Wompi's refund id, PayU's order id).
     */
    public record RefundReply(String outcome, String id, String message) {}
    public interface PayuApi {
        /** PayU's order for one of our references; empty when PayU does not know it or cannot be reached. */
        Optional<String> orderId(boolean sandbox, String apiLogin, String apiKey, String reference);
        RefundReply refund(boolean sandbox, String apiLogin, String apiKey, String orderId, String transactionId, java.math.BigDecimal amount, boolean whole, String reason);
        /** Where a refund of that PayU order stands now. */
        RefundReply refundState(boolean sandbox, String apiLogin, String apiKey, String orderId);
    }
    /** A transaction as Wompi reports it. */
    /** `statusMessage`: Wompi's reason for an error or a decline, when it gives one. */
    public record WompiTransaction(String id, String reference, String status, long amountInCents, String currency, String paymentMethodType, String statusMessage) {}
    public interface WompiApi {
        /** Empty when Wompi does not know the transaction or cannot be reached. */
        Optional<WompiTransaction> transaction(boolean sandbox, String privateKey, String transactionId);
        /** The transaction made for one of our references, for when the shopper comes back without its id. */
        Optional<WompiTransaction> byReference(boolean sandbox, String privateKey, String reference);
        /** Gives `amountInCents` of an approved transaction back (Wompi refunds, POST /v1/refunds). */
        RefundReply refund(boolean sandbox, String privateKey, String transactionId, long amountInCents, String reason);
        /** Where a refund Wompi left in progress stands now (only reads: it never repeats the refund). */
        RefundReply refundState(boolean sandbox, String privateKey, String refundId);
    }
    /** Reads the JSON of a Wompi event without the application knowing a JSON library: paths like "transaction.id". */
    public interface JsonReader {
        Map<String, Object> flatten(String json);
    }
}

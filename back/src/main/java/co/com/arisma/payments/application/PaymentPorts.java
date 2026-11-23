package co.com.arisma.payments.application;
import co.com.arisma.payments.domain.PaymentState;
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
        /** True only for the call that moves the try to approved: the one that may mark the order as paid. */
        boolean approve(String reference, String externalId, String detail);
        /** Updates a try that is not approved; an approved one never goes back. */
        void update(String reference, PaymentState status, String externalId, String detail);
    }
    /** A transaction as Wompi reports it. */
    /** `statusMessage`: Wompi's reason for an error or a decline, when it gives one. */
    public record WompiTransaction(String id, String reference, String status, long amountInCents, String currency, String paymentMethodType, String statusMessage) {}
    public interface WompiApi {
        /** Empty when Wompi does not know the transaction or cannot be reached. */
        Optional<WompiTransaction> transaction(boolean sandbox, String privateKey, String transactionId);
        /** The transaction made for one of our references, for when the shopper comes back without its id. */
        Optional<WompiTransaction> byReference(boolean sandbox, String privateKey, String reference);
    }
    /** Reads the JSON of a Wompi event without the application knowing a JSON library: paths like "transaction.id". */
    public interface JsonReader {
        Map<String, Object> flatten(String json);
    }
}

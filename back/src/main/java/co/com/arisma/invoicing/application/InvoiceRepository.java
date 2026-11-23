package co.com.arisma.invoicing.application;
import co.com.arisma.invoicing.domain.Invoice;
import java.util.Optional;
import java.util.UUID;

/** Persistence port for invoices and the order facts sending one needs. */
public interface InvoiceRepository {
    /** The order an invoice goes with: its number, status and who to send it to (from the billing data). */
    record OrderFacts(UUID id, String number, String status, String customerName, String email) {}
    Optional<OrderFacts> order(UUID orderId);
    Optional<Invoice> find(UUID orderId);
    /** Stores a new file for the order (replacing a previous one, which goes back to "uploaded"). */
    void saveUploaded(UUID orderId, String number, String objectKey, String fileName, int size, String token, UUID actor);
    /** Adds a channel to the invoice and marks it sent. */
    void markSent(UUID orderId, String channel, String to, UUID actor);
    void markNotNeeded(UUID orderId, UUID actor);
    /** The invoice behind a download link, only while it is the order's current file. */
    Optional<Invoice> byToken(String token);
}

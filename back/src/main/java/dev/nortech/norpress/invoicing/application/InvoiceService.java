package dev.nortech.norpress.invoicing.application;
import dev.nortech.norpress.invoicing.domain.Invoice;
import dev.nortech.norpress.media.application.ObjectStore;
import dev.nortech.norpress.notifications.application.NotificationService;
import dev.nortech.norpress.notifications.domain.Message;
import dev.nortech.norpress.sales.application.OrderService;
import dev.nortech.norpress.shared.domain.NotFound;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.Optional;
import java.util.UUID;

/**
 * Invoices of orders: the store attaches the PDF it made in its billing program and sends it to the customer by
 * email (with the file) or WhatsApp (with a download link). Once sent, or marked as not needed, a delivered order is
 * finished. Every step leaves a line in the order's history.
 */
@ApplicationScoped
public class InvoiceService {
    private static final SecureRandom RANDOM = new SecureRandom();
    @Inject InvoiceRepository invoices;
    @Inject ObjectStore files;
    @Inject NotificationService notifications;
    @Inject OrderService orders;

    /** A PDF ready to download. */
    public record Download(String fileName, byte[] bytes) {}

    @Transactional
    public Invoice attach(UUID orderId, byte[] pdf, String rawNumber, UUID actor) {
        var order = order(orderId);
        Invoice.requireInvoiceable(order.status());
        Invoice.requirePdf(pdf);
        var number = Invoice.number(rawNumber);
        var previous = invoices.find(orderId);
        var key = "invoices/" + orderId + "/" + UUID.randomUUID() + ".pdf";
        files.put(key, pdf, "application/pdf");
        var token = token();
        invoices.saveUploaded(orderId, number, key, Invoice.fileName(number, order.number()), pdf.length, token, actor);
        orders.logEvent(orderId, previous.filter(Invoice::hasFile).isPresent() ? "Se reemplazó el PDF de la factura" + (number == null ? "" : " (" + number + ")") : "Se adjuntó la factura" + (number == null ? "" : " " + number), actor);
        // the replaced file is no longer reachable from any link
        previous.filter(Invoice::hasFile).ifPresent(old -> { try { files.delete(old.objectKey()); } catch (RuntimeException ignored) { } });
        return invoices.find(orderId).orElseThrow();
    }

    /** Emails the PDF to the customer (or the address given). Nothing is marked when the mail server refuses it. */
    @Transactional
    public Invoice sendEmail(UUID orderId, String to, String site, UUID actor) {
        var order = order(orderId);
        var invoice = withFile(orderId);
        var address = to == null || to.isBlank() ? order.email() : to.trim();
        if (address == null || address.isBlank()) throw new IllegalArgumentException("El pedido no tiene correo; escribe a cuál enviarla");
        notifications.sendInvoice(address, order.customerName(), order.number(), invoice.number(), link(site, invoice), new Message.Attachment(invoice.fileName(), invoice.objectKey(), "application/pdf"));
        invoices.markSent(orderId, Invoice.EMAIL, address.toLowerCase(java.util.Locale.ROOT), actor);
        orders.logEvent(orderId, "Factura" + suffix(invoice) + " enviada por correo a " + address.toLowerCase(java.util.Locale.ROOT), actor);
        return invoices.find(orderId).orElseThrow();
    }

    /** The panel opened WhatsApp with the download link for the team to send: the invoice counts as sent. */
    @Transactional
    public Invoice markWhatsapp(UUID orderId, UUID actor) {
        order(orderId);
        var invoice = withFile(orderId);
        invoices.markSent(orderId, Invoice.WHATSAPP, null, actor);
        orders.logEvent(orderId, "Factura" + suffix(invoice) + " enviada por WhatsApp", actor);
        return invoices.find(orderId).orElseThrow();
    }

    /** The customer did not need one (or it was given in person): the order is finished without sending anything. */
    @Transactional
    public Invoice notNeeded(UUID orderId, UUID actor) {
        order(orderId);
        if (invoices.find(orderId).filter(Invoice::sent).isPresent()) throw new IllegalArgumentException("La factura de este pedido ya se envió");
        invoices.markNotNeeded(orderId, actor);
        orders.logEvent(orderId, "Marcado como pedido que no requiere factura", actor);
        return invoices.find(orderId).orElseThrow();
    }

    /** The PDF behind a customer's download link. */
    public Download download(String token) {
        if (token == null || !token.matches("[A-Za-z0-9_-]{40,60}")) throw new NotFound("Factura no encontrada");
        var invoice = invoices.byToken(token).filter(Invoice::hasFile).orElseThrow(() -> new NotFound("Factura no encontrada"));
        return new Download(invoice.fileName(), files.get(invoice.objectKey()).bytes());
    }

    /** The PDF of an order, for the panel. */
    public Download file(UUID orderId) {
        var invoice = withFile(orderId);
        return new Download(invoice.fileName(), files.get(invoice.objectKey()).bytes());
    }

    public Optional<Invoice> of(UUID orderId) { return invoices.find(orderId); }

    /** Where the customer downloads the invoice, on the store's own site. */
    public static String link(String site, Invoice invoice) { return site.replaceAll("/+$", "") + "/factura/" + invoice.token(); }

    private InvoiceRepository.OrderFacts order(UUID orderId) { return invoices.order(orderId).orElseThrow(() -> new NotFound("Pedido no encontrado")); }
    private Invoice withFile(UUID orderId) { return invoices.find(orderId).filter(Invoice::hasFile).orElseThrow(() -> new IllegalArgumentException("Primero adjunta el PDF de la factura")); }
    private static String suffix(Invoice invoice) { return invoice.number() == null ? "" : " " + invoice.number(); }
    private static String token() { var bytes = new byte[32]; RANDOM.nextBytes(bytes); return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes); }
}

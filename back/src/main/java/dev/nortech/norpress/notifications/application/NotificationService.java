package dev.nortech.norpress.notifications.application;
import dev.nortech.norpress.notifications.application.NotificationPorts.*;
import dev.nortech.norpress.notifications.domain.Brand;
import dev.nortech.norpress.notifications.domain.Message;
import dev.nortech.norpress.notifications.domain.Templates;
import dev.nortech.norpress.settings.application.StoreSettingsService;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * The store's emails. Each one is written to the outbox inside the transaction of what caused it (so an order that
 * rolls back sends nothing), and a delivery round sends what is due. Without a mail server they stay in the outbox,
 * readable from the panel. Sending never makes the action that caused it fail.
 */
@ApplicationScoped
public class NotificationService {
    static final int MAX_ATTEMPTS = 5;
    @Inject Outbox outbox;
    @Inject Mailer mailer;
    @Inject StoreSettingsService settings;
    @Inject dev.nortech.norpress.media.application.ObjectStore files;
    Clock clock = Clock.systemUTC();

    public void orderPlaced(String to, String name, String number, List<Templates.Line> lines, BigDecimal discount, BigDecimal shipping, BigDecimal total, String method, String link, boolean test) {
        queue(() -> Templates.orderPlaced(brand(), to, name, number, lines, discount, shipping, total, method, link, test));
        String inbox = settings.mail().storeInbox();
        if (!inbox.isEmpty()) queue(() -> Templates.newOrderForStore(brand(), inbox, number, name, total, method, null, test));
    }
    public void paymentApproved(String to, String name, String number, BigDecimal total, String link) { queue(() -> Templates.paymentApproved(brand(), to, name, number, total, link)); }
    public void orderCancelled(String to, String name, String number, BigDecimal refund, String how, String link) { if (to != null && !to.isBlank()) queue(() -> Templates.orderCancelled(brand(), to, name, number, refund, how, link)); }
    public void refundCompleted(String to, String name, String number, BigDecimal amount, String how, String link) { if (to != null && !to.isBlank()) queue(() -> Templates.refundCompleted(brand(), to, name, number, amount, how, link)); }
    public void orderShipped(String to, String name, String number, String carrier, String tracking, String link) { queue(() -> Templates.orderShipped(brand(), to, name, number, carrier, tracking, link)); }
    public void verifyEmail(String to, String name, String link) { queue(() -> Templates.verifyEmail(brand(), to, name, link)); }
    public void resetPassword(String to, String name, String link) { queue(() -> Templates.resetPassword(brand(), to, name, link)); }

    Brand brand() { var p = settings.profile(); return new Brand(p.name(), p.signature(), p.color()); }

    /** Sends right away, outside the outbox rounds, and says what the server answered. */
    @Transactional
    public String sendTest(String to) {
        var server = server().orElseThrow(() -> new IllegalArgumentException("Primero guarda el servidor de correo"));
        var message = Templates.test(brand(), to);
        var id = outbox.store(message, true);
        try { mailer.send(message, server, List.of()); outbox.sent(id, clock.instant()); return "Enviado a " + message.to(); }
        catch (RuntimeException e) { outbox.failed(id, reason(e), clock.instant(), true); throw new IllegalArgumentException("El servidor de correo respondió: " + reason(e)); }
    }

    /** One delivery round: what is due goes out; a failure waits longer each time and gives up after five. */
    public int deliverDue() {
        var server = server();
        if (server.isEmpty()) return 0;
        int sent = 0;
        for (var queued : outbox.due(clock.instant(), 20)) {
            try { mailer.send(queued.message(), server.get(), read(queued.message())); outbox.sent(queued.id(), clock.instant()); sent++; }
            catch (RuntimeException e) {
                int attempt = queued.attempts() + 1;
                outbox.failed(queued.id(), reason(e), clock.instant().plus(Duration.ofMinutes(5L * attempt * attempt)), attempt >= MAX_ATTEMPTS);
            }
        }
        return sent;
    }
    /**
     * The invoice of an order, with its PDF attached, sent right away so the panel can say whether it went out. It stays
     * in the outbox like any other email. Throws with the server's answer when it could not be sent.
     */
    // a refused email is kept in the outbox as failed, so the panel shows what the server said
    @Transactional(value = Transactional.TxType.REQUIRES_NEW, dontRollbackOn = IllegalArgumentException.class)
    public void sendInvoice(String to, String name, String orderNumber, String invoiceNumber, String link, Message.Attachment pdf) {
        var server = server().orElseThrow(() -> new IllegalArgumentException("Configura el correo de la tienda (Tienda → Correo) para enviar facturas por correo"));
        var message = Templates.invoice(brand(), to, name, orderNumber, invoiceNumber, link).withAttachments(List.of(pdf));
        var id = outbox.store(message, true);
        try { mailer.send(message, server, read(message)); outbox.sent(id, clock.instant()); }
        catch (RuntimeException e) { outbox.failed(id, reason(e), clock.instant(), true); throw new IllegalArgumentException("El servidor de correo respondió: " + reason(e)); }
    }

    /** The attachments' bytes, read from where they are kept. */
    private List<File> read(Message message) {
        return message.attachments().stream().map(a -> new File(a.name(), a.contentType(), files.get(a.key()).bytes())).toList();
    }

    public List<Map<String, Object>> latest(int limit, int offset) { return outbox.latest(Math.clamp(limit, 1, 100), Math.max(0, offset)); }
    public long count() { return outbox.count(); }

    private void queue(java.util.function.Supplier<Message> build) {
        Message message;
        try { message = build.get(); } catch (IllegalArgumentException e) { return; } // no valid address: nothing to send
        outbox.store(message, settings.mail().configured());
    }
    private Optional<Smtp> server() {
        var mail = settings.mail();
        if (!mail.configured()) return Optional.empty();
        return Optional.of(new Smtp(mail.host(), mail.port(), mail.security().name(), mail.username(), settings.mailPassword(), mail.fromAddress(), mail.fromName().isEmpty() ? settings.profile().name() : mail.fromName()));
    }
    private static String reason(RuntimeException e) {
        String message = e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage();
        return message.length() > 300 ? message.substring(0, 300) : message;
    }
}

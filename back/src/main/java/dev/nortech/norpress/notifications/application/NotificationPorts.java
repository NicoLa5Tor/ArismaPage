package dev.nortech.norpress.notifications.application;
import dev.nortech.norpress.notifications.domain.Message;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Ports of the notifications module. */
public final class NotificationPorts {
    private NotificationPorts() {}

    /** How to reach the mail server, password included. Built from the store settings at send time. */
    public record Smtp(String host, int port, String security, String username, String password, String fromAddress, String fromName) {}
    /** A file's bytes, ready to go with an email. */
    public record File(String name, String contentType, byte[] bytes) {}
    public interface Mailer {
        /** Throws with a readable reason when the server refuses or cannot be reached. `files` are the message's attachments, already read. */
        void send(Message message, Smtp server, List<File> files);
    }
    public record Queued(UUID id, Message message, int attempts) {}
    public interface Outbox {
        /** pending: it will be sent; otherwise it is only kept (no mail server configured). */
        UUID store(Message message, boolean pending);
        List<Queued> due(Instant now, int limit);
        void sent(UUID id, Instant at);
        void failed(UUID id, String error, Instant retryAt, boolean giveUp);
        /** Newest first, for the panel; with the HTML so it can be previewed. */
        List<Map<String, Object>> latest(int limit, int offset);
        long count();
    }
}

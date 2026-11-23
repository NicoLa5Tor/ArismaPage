package co.com.arisma.notifications.adapter;
import co.com.arisma.notifications.application.NotificationPorts.Outbox;
import co.com.arisma.notifications.application.NotificationPorts.Queued;
import co.com.arisma.notifications.domain.Message;
import co.com.arisma.shared.adapter.Jdbc;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import javax.sql.DataSource;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@ApplicationScoped
public class PostgresOutbox implements Outbox {
    @Inject DataSource db;

    public UUID store(Message m, boolean pending) {
        UUID id = UUID.randomUUID();
        Jdbc.with(db, c -> Jdbc.update(c, "INSERT INTO mail_outbox(id,kind,recipient,subject,body_text,body_html,status,attachments) VALUES(?,?,?,?,?,?,?,?::jsonb)", id, m.kind(), m.to(), m.subject(), m.text(), m.html(), pending ? "pending" : "stored", attachmentsJson(m.attachments())));
        return id;
    }
    /**
     * Claims what is due in one statement (it moves the next try ten minutes ahead), so two rounds or two servers never
     * send the same email; sent or failed then settles it.
     */
    public List<Queued> due(Instant now, int limit) {
        return Jdbc.with(db, c -> Jdbc.list(c, "UPDATE mail_outbox SET next_attempt_at=?::timestamptz + interval '10 minutes' WHERE id IN (SELECT id FROM mail_outbox WHERE status='pending' AND next_attempt_at<=? ORDER BY next_attempt_at LIMIT ? FOR UPDATE SKIP LOCKED)"
            + " RETURNING id,kind,recipient,subject,body_text,body_html,attempts,attachments::text AS attachments", now, now, limit).stream()
            .map(r -> new Queued((UUID) r.get("id"), new Message((String) r.get("kind"), (String) r.get("recipient"), (String) r.get("subject"), (String) r.get("bodyText"), (String) r.get("bodyHtml"), attachmentsOf((String) r.get("attachments"))), ((Number) r.get("attempts")).intValue())).toList());
    }
    private static final com.fasterxml.jackson.databind.ObjectMapper JSON = new com.fasterxml.jackson.databind.ObjectMapper();
    private static String attachmentsJson(List<Message.Attachment> files) {
        try { return JSON.writeValueAsString(files); } catch (com.fasterxml.jackson.core.JsonProcessingException e) { throw new IllegalStateException(e); }
    }
    private static List<Message.Attachment> attachmentsOf(String json) {
        if (json == null || json.isBlank()) return List.of();
        try { return List.of(JSON.readValue(json, Message.Attachment[].class)); } catch (com.fasterxml.jackson.core.JsonProcessingException e) { return List.of(); }
    }
    public void sent(UUID id, Instant at) { Jdbc.with(db, c -> Jdbc.update(c, "UPDATE mail_outbox SET status='sent', sent_at=?, attempts=attempts+1, last_error=NULL WHERE id=?", at, id)); }
    public void failed(UUID id, String error, Instant retryAt, boolean giveUp) {
        Jdbc.with(db, c -> Jdbc.update(c, "UPDATE mail_outbox SET status=?, attempts=attempts+1, last_error=?, next_attempt_at=? WHERE id=?", giveUp ? "failed" : "pending", error, retryAt, id));
    }
    public List<Map<String, Object>> latest(int limit, int offset) {
        return Jdbc.with(db, c -> Jdbc.list(c, "SELECT id,kind,recipient,subject,body_html,status,attempts,last_error,created_at,sent_at FROM mail_outbox ORDER BY created_at DESC, id LIMIT ? OFFSET ?", limit, offset));
    }
    public long count() { return Jdbc.with(db, c -> Jdbc.count(c, "SELECT count(*) AS n FROM mail_outbox")); }
}

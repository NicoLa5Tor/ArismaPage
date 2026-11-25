package dev.nortech.norpress.settings.adapter;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.nortech.norpress.settings.application.SettingsPorts.*;
import dev.nortech.norpress.settings.domain.LegalPages;
import dev.nortech.norpress.shared.adapter.Jdbc;
import dev.nortech.norpress.shared.domain.Conflict;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.Instant;
import java.util.*;
import javax.sql.DataSource;

/** Published legal versions (never updated) and who accepted them, in PostgreSQL. */
@ApplicationScoped
public class PostgresLegal implements LegalRepository {
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final String VERSION = "SELECT id, kind, version, title, content, published_at, published_by FROM legal_version";
    @Inject DataSource db;

    public Optional<LegalVersion> latest(String kind) {
        return Jdbc.with(db, c -> Jdbc.one(c, VERSION + " WHERE kind=? ORDER BY version DESC LIMIT 1", kind).map(PostgresLegal::version));
    }
    public List<LegalVersion> versions(String kind) {
        return Jdbc.with(db, c -> Jdbc.list(c, VERSION + " WHERE kind=? ORDER BY version DESC", kind).stream().map(PostgresLegal::version).toList());
    }
    public LegalVersion publish(String kind, LegalPages.LegalPage page, UUID actor) {
        UUID id = UUID.randomUUID();
        var content = new LinkedHashMap<>(page.toMap());
        content.remove("title");
        try {
            Jdbc.with(db, c -> Jdbc.update(c, "INSERT INTO legal_version(id, kind, version, title, content, published_by)"
                + " SELECT ?, ?, COALESCE(max(version),0)+1, ?, ?::jsonb, ? FROM legal_version WHERE kind=?", id, kind, page.title(), json(content), actor, kind));
        } catch (IllegalStateException e) {
            if (Jdbc.duplicate(e)) throw new Conflict("Alguien acaba de publicar esta página. Recarga y vuelve a intentarlo.");
            throw e;
        }
        return Jdbc.with(db, c -> Jdbc.one(c, VERSION + " WHERE id=?", id).map(PostgresLegal::version)).orElseThrow();
    }
    public void accept(List<Acceptance> rows) {
        Jdbc.with(db, c -> {
            for (var a : rows) Jdbc.update(c, "INSERT INTO legal_acceptance(id, version_id, context, order_id, account_id, ip, user_agent)"
                + " VALUES(?, ?, ?, (SELECT id FROM sales_order WHERE number=?), ?, ?, ?)",
                UUID.randomUUID(), a.versionId(), a.context(), a.orderNumber(), a.accountId(), a.ip(), a.userAgent());
            return rows.size();
        });
    }
    public boolean accepted(UUID accountId, UUID versionId) {
        return Jdbc.with(db, c -> Jdbc.count(c, "SELECT count(*) AS n FROM legal_acceptance WHERE account_id=? AND version_id=?", accountId, versionId) > 0);
    }
    public List<Map<String, Object>> acceptances(UUID accountId) {
        return Jdbc.with(db, c -> Jdbc.list(c, "SELECT v.kind, v.version, v.title, a.context, o.number AS order_number, a.accepted_at FROM legal_acceptance a"
            + " JOIN legal_version v ON v.id=a.version_id LEFT JOIN sales_order o ON o.id=a.order_id"
            + " WHERE a.account_id=? OR a.order_id IN (SELECT id FROM sales_order WHERE account_id=?) ORDER BY a.accepted_at DESC", accountId, accountId));
    }

    private static LegalVersion version(Map<String, Object> r) {
        var content = JSON.convertValue((JsonNode) r.get("content"), new TypeReference<Map<String, Object>>() {});
        content.put("title", r.get("title"));
        return new LegalVersion((UUID) r.get("id"), (String) r.get("kind"), ((Number) r.get("version")).intValue(), LegalPages.LegalPage.fromMap(content),
            (Instant) r.get("publishedAt"), (UUID) r.get("publishedBy"));
    }
    private static String json(Object value) {
        try { return JSON.writeValueAsString(value); } catch (JsonProcessingException e) { throw new IllegalStateException(e); }
    }
}

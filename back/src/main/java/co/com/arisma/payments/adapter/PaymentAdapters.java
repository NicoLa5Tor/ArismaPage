package co.com.arisma.payments.adapter;
import co.com.arisma.payments.application.PaymentPorts.*;
import co.com.arisma.payments.domain.PaymentState;
import co.com.arisma.shared.adapter.Jdbc;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import javax.sql.DataSource;
import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.*;

/** Persistence and outbound HTTP of the payments module. */
public final class PaymentAdapters {
    private PaymentAdapters() {}
    private static final ObjectMapper JSON = new ObjectMapper();

    @ApplicationScoped
    public static class PostgresAttempts implements AttemptRepository {
        private static final String SELECT = "SELECT reference, order_id, gateway, amount, sandbox, status, COALESCE(detail,'') AS detail FROM payment_attempt";
        @Inject DataSource db;
        private static Attempt read(Map<String, Object> r) {
            return new Attempt((String) r.get("reference"), (UUID) r.get("orderId"), (String) r.get("gateway"), (BigDecimal) r.get("amount"), (Boolean) r.get("sandbox"), PaymentState.fromDb((String) r.get("status")), (String) r.get("detail"));
        }
        public void insert(Attempt a) {
            Jdbc.with(db, c -> Jdbc.update(c, "INSERT INTO payment_attempt(reference,order_id,gateway,amount,sandbox,status) VALUES(?,?,?,?,?,?) ON CONFLICT (reference) DO NOTHING", a.reference(), a.orderId(), a.gateway(), a.amount(), a.sandbox(), a.status().db()));
        }
        public Optional<Attempt> find(String reference) {
            if (reference == null || reference.isBlank() || reference.length() > 80) return Optional.empty();
            return Jdbc.with(db, c -> Jdbc.one(c, SELECT + " WHERE reference=? FOR UPDATE", reference).map(PostgresAttempts::read));
        }
        public List<Attempt> open(String gateway, java.time.Instant since, int limit) {
            return Jdbc.with(db, c -> Jdbc.list(c, "SELECT a.reference, a.order_id, a.gateway, a.amount, a.sandbox, a.status FROM payment_attempt a JOIN sales_order o ON o.id=a.order_id"
                + " WHERE a.gateway=? AND a.status IN ('started','pending') AND a.created_at>? AND o.status='pending' ORDER BY a.created_at DESC LIMIT ?", gateway, since, limit).stream().map(PostgresAttempts::read).toList());
        }
        public Optional<Attempt> latest(UUID orderId) { return Jdbc.with(db, c -> Jdbc.one(c, SELECT + " WHERE order_id=? ORDER BY (status='approved') DESC, created_at DESC LIMIT 1", orderId).map(PostgresAttempts::read)); }
        public boolean approve(String reference, String externalId, String detail) {
            return Jdbc.with(db, c -> Jdbc.update(c, "UPDATE payment_attempt SET status='approved', external_id=?, detail=?, updated_at=now() WHERE reference=? AND status<>'approved'", externalId, detail, reference) > 0);
        }
        public void update(String reference, PaymentState status, String externalId, String detail) {
            Jdbc.with(db, c -> Jdbc.update(c, "UPDATE payment_attempt SET status=?, external_id=COALESCE(?,external_id), detail=?, updated_at=now() WHERE reference=? AND status<>'approved'", status.db(), externalId, detail, reference));
        }
    }

    /** Transaction lookup, which Wompi only answers to the private key. Hosts are fixed: sandbox or production. */
    @ApplicationScoped
    public static class HttpWompiApi implements WompiApi {
        private static final HttpClient HTTP = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(6)).build();
        public Optional<WompiTransaction> transaction(boolean sandbox, String privateKey, String transactionId) {
            return get(sandbox, privateKey, "/v1/transactions/" + enc(transactionId)).map(body -> body.path("data")).flatMap(HttpWompiApi::read);
        }
        /** Wompi lists the transactions of a reference; the newest final one wins, else the newest of all. */
        public Optional<WompiTransaction> byReference(boolean sandbox, String privateKey, String reference) {
            return get(sandbox, privateKey, "/v1/transactions?reference=" + enc(reference)).flatMap(body -> {
                var found = new java.util.ArrayList<WompiTransaction>();
                for (JsonNode item : body.path("data")) read(item).ifPresent(found::add);
                return found.stream().filter(t -> !t.status().equals("PENDING")).findFirst().or(() -> found.stream().findFirst());
            });
        }
        private static Optional<JsonNode> get(boolean sandbox, String privateKey, String path) {
            try {
                var uri = URI.create((sandbox ? "https://sandbox.wompi.co" : "https://production.wompi.co") + path);
                var response = HTTP.send(HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(10)).header("Authorization", "Bearer " + privateKey).GET().build(), HttpResponse.BodyHandlers.ofString());
                return response.statusCode() == 200 ? Optional.of(JSON.readTree(response.body())) : Optional.empty();
            } catch (InterruptedException e) { Thread.currentThread().interrupt(); return Optional.empty(); }
            catch (Exception e) { return Optional.empty(); }
        }
        private static Optional<WompiTransaction> read(JsonNode data) {
            if (!data.path("id").isTextual() || !data.path("reference").isTextual()) return Optional.empty();
            return Optional.of(new WompiTransaction(data.path("id").asText(), data.path("reference").asText(), data.path("status").asText(""), data.path("amount_in_cents").asLong(-1), data.path("currency").asText(""), data.path("payment_method_type").asText(null), data.path("status_message").asText("")));
        }
        private static String enc(String value) { return java.net.URLEncoder.encode(value, java.nio.charset.StandardCharsets.UTF_8); }
    }

    @ApplicationScoped
    public static class JacksonJsonReader implements JsonReader {
        public Map<String, Object> flatten(String json) {
            if (json == null || json.length() > 100_000) throw new IllegalArgumentException("JSON inválido");
            try {
                var out = new LinkedHashMap<String, Object>();
                walk("", JSON.readTree(json), out, 0);
                return out;
            } catch (com.fasterxml.jackson.core.JsonProcessingException e) { throw new IllegalArgumentException("JSON inválido"); }
        }
        private static void walk(String path, JsonNode node, Map<String, Object> out, int depth) {
            if (depth > 8) return;
            if (node.isObject()) node.fields().forEachRemaining(e -> walk(path.isEmpty() ? e.getKey() : path + "." + e.getKey(), e.getValue(), out, depth + 1));
            else if (node.isArray()) { var list = new ArrayList<String>(); node.forEach(item -> list.add(item.asText())); out.put(path, list); }
            else if (node.isNumber()) out.put(path, node.numberValue());
            else if (node.isBoolean()) out.put(path, node.booleanValue());
            else if (!node.isNull()) out.put(path, node.asText());
        }
    }
}

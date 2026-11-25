package dev.nortech.norpress.payments.adapter;
import dev.nortech.norpress.payments.application.PaymentPorts.*;
import dev.nortech.norpress.payments.domain.PaymentState;
import dev.nortech.norpress.shared.adapter.Jdbc;
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
        public java.util.Set<UUID> waiting(java.time.Instant since) {
            return Jdbc.with(db, c -> Jdbc.list(c, "SELECT o.id FROM sales_order o WHERE o.status='pending' AND o.expires_at>? AND (SELECT a.status FROM payment_attempt a WHERE a.order_id=o.id ORDER BY a.created_at DESC LIMIT 1)='pending'", since)
                .stream().map(r -> (UUID) r.get("id")).collect(java.util.stream.Collectors.toSet()));
        }
        public Optional<Attempt> latest(UUID orderId) { return Jdbc.with(db, c -> Jdbc.one(c, SELECT + " WHERE order_id=? ORDER BY (status='approved') DESC, created_at DESC LIMIT 1", orderId).map(PostgresAttempts::read)); }
        public boolean approve(String reference, String externalId, String detail) {
            return Jdbc.with(db, c -> Jdbc.update(c, "UPDATE payment_attempt SET status='approved', external_id=?, detail=?, updated_at=now() WHERE reference=? AND status<>'approved'", externalId, detail, reference) > 0);
        }
        public Optional<Approved> approved(UUID orderId) {
            return Jdbc.with(db, c -> Jdbc.one(c, "SELECT reference, gateway, sandbox, external_id, COALESCE(detail,'') AS detail, updated_at FROM payment_attempt WHERE order_id=? AND status='approved' ORDER BY updated_at DESC LIMIT 1", orderId)
                .map(r -> new Approved((String) r.get("reference"), (String) r.get("gateway"), (Boolean) r.get("sandbox"), (String) r.get("externalId"), (String) r.get("detail"), (java.time.Instant) r.get("updatedAt"))));
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
        /**
         * 2xx: Wompi's status (APPROVED, DECLINED, ERROR, CANCELLED…). 4xx: refused, nothing happened. No answer or 5xx:
         * unknown, so it is never sent again on its own.
         */
        public RefundReply refund(boolean sandbox, String privateKey, String transactionId, long amountInCents, String reason) {
            try {
                var body = JSON.createObjectNode().put("transaction_id", transactionId).put("amount_in_cents", amountInCents).put("reason", reason == null ? "" : reason).toString();
                var uri = URI.create((sandbox ? "https://sandbox.wompi.co" : "https://production.wompi.co") + "/v1/refunds");
                var response = HTTP.send(HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(20)).header("Authorization", "Bearer " + privateKey).header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(body)).build(), HttpResponse.BodyHandlers.ofString());
                int code = response.statusCode();
                JsonNode json = null;
                try { json = JSON.readTree(response.body()); } catch (Exception ignored) { /* not JSON */ }
                if (code >= 500 || json == null && code >= 200 && code < 300) return new RefundReply("UNKNOWN", "", "Wompi respondió " + code);
                if (code >= 400) return new RefundReply("DECLINED", "", wompiError(json, code));
                var data = json.path("data");
                String id = data.path("id").asText(""), status = data.path("status").asText("").toUpperCase(Locale.ROOT), message = data.path("status_message").asText("");
                return wompiRefund(status, id, message);
            } catch (InterruptedException e) { Thread.currentThread().interrupt(); return new RefundReply("UNKNOWN", "", "La consulta a Wompi se interrumpió"); }
            catch (Exception e) { return new RefundReply("UNKNOWN", "", "No se pudo conectar con Wompi"); }
        }
        public RefundReply refundState(boolean sandbox, String privateKey, String refundId) {
            if (refundId == null || !refundId.matches("[A-Za-z0-9_-]{1,80}")) return new RefundReply("UNKNOWN", "", "Referencia de reembolso inválida");
            return get(sandbox, privateKey, "/v1/refunds/" + enc(refundId)).map(body -> body.path("data"))
                .map(d -> wompiRefund(d.path("status").asText("").toUpperCase(Locale.ROOT), refundId, d.path("status_message").asText("")))
                .orElse(new RefundReply("UNKNOWN", refundId, "Wompi no respondió la consulta del reembolso"));
        }
        /** Wompi's refund statuses: approved, refused for good, or still in progress (PENDING and any other). */
        private static RefundReply wompiRefund(String status, String id, String message) {
            return switch (status) {
                case "APPROVED" -> new RefundReply("APPROVED", id, message);
                case "DECLINED", "ERROR", "CANCELLED", "VOIDED" -> new RefundReply("DECLINED", id, message.isBlank() ? "Wompi respondió " + status : message);
                case "" -> new RefundReply("UNKNOWN", id, "Wompi no dijo en qué estado quedó el reembolso");
                default -> new RefundReply("PENDING", id, "Wompi lo dejó en estado " + status);
            };
        }
        private static String wompiError(JsonNode json, int code) {
            if (json == null) return "Wompi rechazó el reembolso (" + code + ")";
            var error = json.path("error");
            String reason = error.path("reason").asText("");
            if (reason.isBlank() && error.path("messages").isObject()) {
                var parts = new ArrayList<String>();
                error.path("messages").fields().forEachRemaining(e -> e.getValue().forEach(m -> parts.add(m.asText())));
                reason = String.join("; ", parts);
            }
            if (reason.isBlank()) reason = error.path("type").asText("");
            reason = reason.replaceAll("[\\p{Cntrl}<>]", " ").trim();
            if (reason.length() > 200) reason = reason.substring(0, 200);
            return reason.isBlank() ? "Wompi rechazó el reembolso (" + code + ")" : reason;
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

    /**
     * PayU's payments API (refunds) and reports API (order lookups). Hosts are fixed: sandbox or production. PayU answers
     * HTTP 200 with code SUCCESS or ERROR; a refund usually starts PENDING while PayU reviews it.
     */
    @ApplicationScoped
    public static class HttpPayuApi implements PayuApi {
        private static final HttpClient HTTP = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(6)).build();
        public Optional<String> orderId(boolean sandbox, String apiLogin, String apiKey, String reference) {
            var request = base(sandbox, apiLogin, apiKey, "ORDER_DETAIL_BY_REFERENCE_CODE");
            request.putObject("details").put("referenceCode", reference);
            return call(sandbox, "reports-api", request).flatMap(json -> {
                if (!"SUCCESS".equals(json.path("code").asText())) return Optional.empty();
                for (JsonNode order : json.path("result").path("payload")) if (order.path("id").isNumber() || order.path("id").isTextual()) return Optional.of(order.path("id").asText());
                return Optional.empty();
            });
        }
        public RefundReply refund(boolean sandbox, String apiLogin, String apiKey, String orderId, String transactionId, BigDecimal amount, boolean whole, String reason) {
            var request = base(sandbox, apiLogin, apiKey, "SUBMIT_TRANSACTION");
            var tx = request.putObject("transaction");
            tx.putObject("order").put("id", orderId);
            tx.put("type", whole ? "REFUND" : "PARTIAL_REFUND").put("reason", reason == null ? "" : reason).put("parentTransactionId", transactionId);
            if (!whole) tx.putObject("additionalValues").putObject("TX_VALUE").put("value", amount.setScale(0, java.math.RoundingMode.HALF_UP).toPlainString()).put("currency", "COP");
            var reply = call(sandbox, "payments-api", request).orElse(null);
            if (reply == null) return new RefundReply("UNKNOWN", orderId, "No se pudo conectar con PayU");
            if (!"SUCCESS".equals(reply.path("code").asText())) return new RefundReply("DECLINED", orderId, clean(reply.path("error").asText("PayU rechazó el reembolso")));
            var response = reply.path("transactionResponse");
            String state = response.path("state").asText("").toUpperCase(Locale.ROOT), message = clean(response.path("responseMessage").asText(""));
            return switch (state) {
                case "APPROVED" -> new RefundReply("APPROVED", orderId, message);
                case "PENDING" -> new RefundReply("PENDING", orderId, message);
                case "DECLINED", "ERROR", "EXPIRED" -> new RefundReply("DECLINED", orderId, message.isBlank() ? "PayU respondió " + state : message);
                default -> new RefundReply("UNKNOWN", orderId, "PayU respondió un estado desconocido");
            };
        }
        /** The order REFUNDED, or its newest refund transaction: final when approved, or declined for good (MANUAL_REFUND). */
        public RefundReply refundState(boolean sandbox, String apiLogin, String apiKey, String orderId) {
            var request = base(sandbox, apiLogin, apiKey, "ORDER_DETAIL");
            request.putObject("details").put("orderId", Long.parseLong(orderId));
            var reply = call(sandbox, "reports-api", request).orElse(null);
            if (reply == null || !"SUCCESS".equals(reply.path("code").asText())) return new RefundReply("UNKNOWN", orderId, "PayU no respondió");
            var order = reply.path("result").path("payload");
            if ("REFUNDED".equals(order.path("status").asText())) return new RefundReply("APPROVED", orderId, "");
            JsonNode last = null;
            for (JsonNode t : order.path("transactions")) { String type = t.path("type").asText(""); if (type.equals("REFUND") || type.equals("PARTIAL_REFUND")) last = t; }
            if (last == null) return new RefundReply("PENDING", orderId, "");
            String state = last.path("transactionResponse").path("state").asText("").toUpperCase(Locale.ROOT);
            String manual = last.path("extraParameters").path("MANUAL_REFUND").asText("");
            if (state.equals("APPROVED")) return new RefundReply("APPROVED", orderId, "");
            if (state.equals("DECLINED") && manual.equalsIgnoreCase("TRUE")) return new RefundReply("DECLINED", orderId, clean(last.path("transactionResponse").path("responseMessage").asText("PayU rechazó el reembolso")));
            return new RefundReply("PENDING", orderId, "");
        }
        private static com.fasterxml.jackson.databind.node.ObjectNode base(boolean sandbox, String apiLogin, String apiKey, String command) {
            var request = JSON.createObjectNode().put("language", "es").put("command", command).put("test", sandbox);
            request.putObject("merchant").put("apiLogin", apiLogin).put("apiKey", apiKey);
            return request;
        }
        private static Optional<JsonNode> call(boolean sandbox, String api, JsonNode request) {
            try {
                var uri = URI.create((sandbox ? "https://sandbox.api.payulatam.com/" : "https://api.payulatam.com/") + api + "/4.0/service.cgi");
                var response = HTTP.send(HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(25)).header("Content-Type", "application/json; charset=utf-8").header("Accept", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(request.toString())).build(), HttpResponse.BodyHandlers.ofString());
                if (response.statusCode() != 200) return Optional.empty();
                return Optional.of(JSON.readTree(response.body()));
            } catch (InterruptedException e) { Thread.currentThread().interrupt(); return Optional.empty(); }
            catch (Exception e) { return Optional.empty(); }
        }
        private static String clean(String text) {
            String t = text == null ? "" : text.replaceAll("[\\p{Cntrl}<>]", " ").replaceAll("\\s+", " ").trim();
            return t.length() > 200 ? t.substring(0, 200) : t;
        }
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

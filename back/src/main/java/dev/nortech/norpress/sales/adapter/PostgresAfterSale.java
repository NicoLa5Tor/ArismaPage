package dev.nortech.norpress.sales.adapter;
import dev.nortech.norpress.sales.application.AfterSaleRepository;
import dev.nortech.norpress.sales.domain.AfterSale;
import dev.nortech.norpress.shared.adapter.Jdbc;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import javax.sql.DataSource;

/**
 * Cancellation requests, refunds and refund accounts in PostgreSQL. "Paid" is the order total once it has a payment
 * date or went through a paid status (a payment confirmed from the panel by moving the order on).
 */
@ApplicationScoped
public class PostgresAfterSale implements AfterSaleRepository {
    @Inject DataSource db;
    /** What the shopper paid for order o: its total once paid, else 0. */
    public static final String PAID = "CASE WHEN o.paid_at IS NOT NULL OR EXISTS(SELECT 1 FROM order_status_history h WHERE h.order_id=o.id AND h.to_status IN ('processing','completed')) THEN o.total ELSE 0 END";
    private static final String ROW = "SELECT id, order_id, amount, route, status, gateway_reference, failure, sent_at, refunded_at AS created_at FROM order_refund";

    public Optional<Standing> standing(UUID orderId) {
        return Jdbc.with(db, c -> Jdbc.one(c, "SELECT o.id, o.number, sg.stage, " + PAID + " AS paid,"
            + " (SELECT COALESCE(sum(r.amount),0) FROM order_refund r WHERE r.order_id=o.id AND r.status='succeeded') AS refunded,"
            + " (SELECT COALESCE(sum(r.amount),0) FROM order_refund r WHERE r.order_id=o.id AND r.status<>'succeeded') AS in_progress,"
            + " o.source_key IS NOT NULL AS migrated, COALESCE(o.billing->>'email','') AS email, trim(COALESCE(o.billing->>'first_name','')||' '||COALESCE(o.billing->>'last_name','')) AS name"
            + " FROM sales_order o JOIN v_order_stage sg ON sg.order_id=o.id WHERE o.id=?", orderId)
            .map(r -> new Standing((UUID) r.get("id"), (String) r.get("number"), (String) r.get("stage"), (BigDecimal) r.get("paid"), (BigDecimal) r.get("refunded"),
                (BigDecimal) r.get("inProgress"), (Boolean) r.get("migrated"), (String) r.get("email"), (String) r.get("name"))));
    }
    public Optional<Request> openRequest(UUID orderId) {
        return Jdbc.with(db, c -> Jdbc.one(c, "SELECT id, reason, status FROM order_cancellation_request WHERE order_id=? AND status='requested'", orderId)
            .map(r -> new Request((UUID) r.get("id"), (String) r.get("reason"), (String) r.get("status"))));
    }
    public void insertRequest(UUID orderId, String reason) {
        Jdbc.with(db, c -> Jdbc.update(c, "INSERT INTO order_cancellation_request(id, order_id, reason) VALUES(?,?,?)", UUID.randomUUID(), orderId, reason));
    }
    public void decide(UUID requestId, boolean approved, String answer, UUID actor) {
        Jdbc.with(db, c -> Jdbc.update(c, "UPDATE order_cancellation_request SET status=?, answer=?, decided_at=now(), decided_by=? WHERE id=? AND status='requested'",
            approved ? "approved" : "rejected", answer, actor, requestId));
    }
    public void insertRefund(UUID orderId, AfterSale.Refund refund, UUID actor) {
        Jdbc.with(db, c -> Jdbc.update(c, "INSERT INTO order_refund(id, order_id, amount, method, reference, note, created_by, route, status, completed_at) VALUES(?,?,?,?,?,?,?,'manual','succeeded',now())",
            UUID.randomUUID(), orderId, refund.amount(), refund.method().db(), refund.reference(), refund.note(), actor));
    }
    public UUID insertPending(UUID orderId, BigDecimal amount, String route, String status, String requestedBy, UUID actor) {
        UUID id = UUID.randomUUID();
        Jdbc.with(db, c -> Jdbc.update(c, "INSERT INTO order_refund(id, order_id, amount, method, route, status, requested_by, created_by) VALUES(?,?,?,?,?,?,?,?)",
            id, orderId, amount, route.equals("transfer") ? "transfer" : "gateway", route, status, requestedBy, actor));
        return id;
    }
    public Optional<RefundRow> refund(UUID refundId) { return Jdbc.with(db, c -> Jdbc.one(c, ROW + " WHERE id=? FOR UPDATE", refundId).map(PostgresAfterSale::row)); }
    public Optional<RefundRow> openRefund(UUID orderId) {
        return Jdbc.with(db, c -> Jdbc.one(c, ROW + " WHERE order_id=? AND status IN ('processing','checking','to_transfer') FOR UPDATE", orderId).map(PostgresAfterSale::row));
    }
    public boolean claim(UUID refundId) {
        return Jdbc.with(db, c -> Jdbc.update(c, "UPDATE order_refund SET sent_at=now(), updated_at=now() WHERE id=? AND status='processing' AND sent_at IS NULL", refundId) > 0);
    }
    public void update(UUID refundId, String status, String gatewayReference, String failure) {
        Jdbc.with(db, c -> Jdbc.update(c, "UPDATE order_refund SET status=?, gateway_reference=COALESCE(NULLIF(?,''), gateway_reference), failure=?, method=CASE WHEN ?='to_transfer' THEN 'transfer' ELSE method END, updated_at=now() WHERE id=? AND status<>'succeeded'",
            status, gatewayReference == null ? "" : gatewayReference, failure == null ? "" : failure, status, refundId));
    }
    public void complete(UUID refundId, String method, String reference, UUID actor) {
        Jdbc.with(db, c -> Jdbc.update(c, "UPDATE order_refund SET status='succeeded', method=?, reference=?, failure='', completed_at=now(), updated_at=now(), created_by=COALESCE(created_by,?) WHERE id=? AND status<>'succeeded'",
            method, reference == null ? "" : reference, actor, refundId));
    }
    public List<RefundRow> pending(int limit) {
        // never sent (older than a minute: the request that created it sends it itself), or PayU still reviewing it
        return Jdbc.with(db, c -> Jdbc.list(c, ROW + " WHERE (status='processing' AND sent_at IS NULL AND refunded_at < now() - interval '1 minute')"
            + " OR (status IN ('processing','checking') AND sent_at IS NOT NULL AND gateway_reference<>'' AND updated_at < now() - interval '2 minutes') ORDER BY refunded_at LIMIT ?", limit).stream().map(PostgresAfterSale::row).toList());
    }
    public void savePayout(UUID orderId, String sealed) {
        Jdbc.with(db, c -> Jdbc.update(c, "INSERT INTO refund_payout(order_id, sealed) VALUES(?,?) ON CONFLICT (order_id) DO UPDATE SET sealed=EXCLUDED.sealed, created_at=now()", orderId, sealed));
    }
    public Optional<String> payout(UUID orderId) { return Jdbc.with(db, c -> Jdbc.one(c, "SELECT sealed FROM refund_payout WHERE order_id=?", orderId).map(r -> (String) r.get("sealed"))); }
    public void deletePayout(UUID orderId) { Jdbc.with(db, c -> Jdbc.update(c, "DELETE FROM refund_payout WHERE order_id=?", orderId)); }

    private static RefundRow row(Map<String, Object> r) {
        return new RefundRow((UUID) r.get("id"), (UUID) r.get("orderId"), (BigDecimal) r.get("amount"), (String) r.get("route"), (String) r.get("status"),
            (String) r.get("gatewayReference"), (String) r.get("failure"), (Instant) r.get("sentAt"), (Instant) r.get("createdAt"));
    }
}

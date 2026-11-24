package dev.nortech.norpress.sales.adapter;
import dev.nortech.norpress.sales.domain.OrderJourney;
import dev.nortech.norpress.sales.application.OrderPlacement;
import dev.nortech.norpress.sales.application.StorefrontOrders;
import dev.nortech.norpress.sales.domain.OrderStatus;
import dev.nortech.norpress.shared.adapter.Jdbc;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import javax.sql.DataSource;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;

@ApplicationScoped
public class PostgresStorefrontOrders implements OrderPlacement.Writer, StorefrontOrders, dev.nortech.norpress.sales.application.PurchaseHistory {
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final String PAYABLE = "SELECT id, number, status, test, total, tax_total, payment_method, billing, shipping, expires_at, (SELECT COALESCE(sum(l.total),0) FROM order_line l WHERE l.order_id=sales_order.id AND l.tax>0) AS tax_base FROM sales_order";
    @Inject DataSource db;

    public boolean purchased(UUID customerId, UUID productId) {
        return Jdbc.with(db, c -> Jdbc.one(c, "SELECT 1 FROM order_line l JOIN v_paid_order o ON o.id=l.order_id WHERE o.customer_id=? AND l.product_id=? LIMIT 1", customerId, productId).isPresent());
    }
    public String nextNumber() { return Jdbc.with(db, c -> String.valueOf(Jdbc.count(c, "SELECT nextval('sales_order_number_seq') AS n"))); }

    public void insert(UUID id, String number, OrderPlacement.NewOrder o) {
        Jdbc.with(db, c -> Jdbc.update(c, "INSERT INTO sales_order(id,number,customer_id,account_id,status,subtotal,discount_total,shipping_total,tax_total,total,prices_include_tax,payment_method,payment_method_title,created_via,placed_at,billing,shipping,customer_note,public_token_hash,expires_at,test)"
            + " VALUES(?,?,?,?,'pending',?,?,?,?,?,false,?,?,'storefront',now(),?::jsonb,?::jsonb,?,?,?,?)",
            id, number, o.customerId(), o.accountId(), o.subtotal(), o.discountTotal(), o.shippingCost(), o.tax(), o.total(), o.paymentMethod(), o.paymentTitle(), json(o.billing()), json(o.shipping()), o.note(), o.publicTokenHash(), o.expiresAt(), o.test()));
    }
    public void insertLine(UUID lineId, UUID orderId, OrderPlacement.NewLine l, int stockReduced) {
        Jdbc.with(db, c -> Jdbc.update(c, "INSERT INTO order_line(id,order_id,product_id,sku,title,quantity,unit_price,subtotal,discount,tax,total,tax_rate_percent,stock_reduced) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
            lineId, orderId, l.productId(), l.sku(), l.title(), l.quantity(), l.unitNet(), l.subtotal(), l.discount(), l.tax(), l.total(), l.taxPercent(), stockReduced));
    }
    public void insertShipping(UUID orderId, String method, String label, BigDecimal cost) {
        Jdbc.with(db, c -> Jdbc.update(c, "INSERT INTO order_shipping(id,order_id,method,label,cost) VALUES(?,?,?,?,?)", UUID.randomUUID(), orderId, method, label, cost));
    }
    public void insertDiscount(UUID orderId, OrderPlacement.NewDiscount d) {
        Jdbc.with(db, c -> Jdbc.update(c, "INSERT INTO order_discount(id,order_id,coupon_id,code,amount,tax) VALUES(?,?,?,?,?,?)", UUID.randomUUID(), orderId, d.couponId(), d.code(), d.amount(), d.tax()));
    }
    public List<UUID> expired(Instant now, int limit) {
        return Jdbc.with(db, c -> Jdbc.list(c, "SELECT id FROM sales_order WHERE status='pending' AND expires_at IS NOT NULL AND expires_at<? ORDER BY expires_at LIMIT ?", now, limit).stream().map(r -> (UUID) r.get("id")).toList());
    }

    /** The condition an Access stands for; its parameters follow the order number. */
    // the order key opens only orders without an account (the store's older guest orders): an order of an account is
    // seen signed in with that account, so a forwarded or leaked link shows nothing
    private static final String ALLOWED = " AND ((?::text IS NOT NULL AND public_token_hash=? AND account_id IS NULL) OR (?::uuid IS NOT NULL AND account_id=?) OR (?::uuid IS NOT NULL AND customer_id=?))";
    private static Object[] allowed(Access a) { return new Object[]{a.number(), a.keyHash(), a.keyHash(), a.accountId(), a.accountId(), a.customerId(), a.customerId()}; }
    private static boolean usable(Access a) { return a != null && a.number() != null && a.number().length() <= 20 && (a.keyHash() != null || a.accountId() != null); }

    public Optional<Payable> payable(Access access) {
        if (!usable(access)) return Optional.empty();
        return Jdbc.with(db, c -> Jdbc.one(c, PAYABLE + " WHERE number=?" + ALLOWED, allowed(access)).map(PostgresStorefrontOrders::payable));
    }
    public List<Map<String, Object>> owned(UUID accountId, UUID customerId, int limit, int offset) {
        return Jdbc.with(db, c -> withNews(c, Jdbc.list(c, "SELECT o.id, COALESCE(o.shopper_seen_at, o.placed_at) AS seen_at, o.number, o.status, o.test, o.total, o.placed_at, o.payment_method_title, " + SHOPPER_STAGE + ", (SELECT count(*) FROM order_line l WHERE l.order_id=o.id) AS lines,"
            + " (SELECT l.title FROM order_line l WHERE l.order_id=o.id ORDER BY l.id LIMIT 1) AS first_title, (SELECT cv.image_id FROM order_line l JOIN v_product_cover cv ON cv.product_id=l.product_id WHERE l.order_id=o.id ORDER BY l.id LIMIT 1) AS image_id,"
            + " (SELECT cv.original_url FROM order_line l JOIN v_product_cover cv ON cv.product_id=l.product_id WHERE l.order_id=o.id ORDER BY l.id LIMIT 1) AS image_url,"
            + " (SELECT l.product_id FROM order_line l JOIN v_product_cover cv ON cv.product_id=l.product_id WHERE l.order_id=o.id ORDER BY l.id LIMIT 1) AS product_id,"
            + " (SELECT COALESCE(cv.uploaded,false) FROM order_line l JOIN v_product_cover cv ON cv.product_id=l.product_id WHERE l.order_id=o.id ORDER BY l.id LIMIT 1) AS image_uploaded"
            + " FROM sales_order o JOIN v_order_stage sg ON sg.order_id=o.id WHERE o.account_id=? OR (?::uuid IS NOT NULL AND o.customer_id=?) ORDER BY o.placed_at DESC, o.id LIMIT ? OFFSET ?",
            accountId, customerId, customerId, Math.clamp(limit, 1, 50), Math.max(0, offset))));
    }

    /** Adds to each order (with its id and seen_at) its newest step and whether the shopper has not seen it; drops both. */
    private static List<Map<String, Object>> withNews(java.sql.Connection c, List<Map<String, Object>> rows) throws java.sql.SQLException {
        var journeys = journeys(c, rows.stream().map(r -> (UUID) r.get("id")).toList());
        var out = new ArrayList<Map<String, Object>>();
        for (var row : rows) {
            var order = new LinkedHashMap<>(row);
            UUID id = (UUID) order.remove("id");
            Instant seen = (Instant) order.remove("seenAt");
            var latest = OrderJourney.latest(journeys.getOrDefault(id, List.of()));
            order.put("latestStep", latest == null ? null : latest.title());
            order.put("latestAt", latest == null ? null : latest.at());
            order.put("unseen", latest != null && seen != null && latest.at().isAfter(seen));
            out.add(order);
        }
        return out;
    }

    /** Each order's journey, from its recorded changes, in one pass. */
    static Map<UUID, List<OrderJourney.Step>> journeys(java.sql.Connection c, List<UUID> ids) throws java.sql.SQLException {
        if (ids.isEmpty()) return Map.of();
        var array = c.createArrayOf("uuid", ids.toArray());
        var changes = new HashMap<UUID, List<OrderJourney.Change>>();
        for (var r : Jdbc.list(c, "SELECT 'order' AS source, h.order_id, h.from_status, h.to_status, h.created_at FROM order_status_history h WHERE h.order_id = ANY(?)"
                + " UNION ALL SELECT 'shipment', s.order_id, e.from_status, e.to_status, e.created_at FROM shipment_event e JOIN shipment s ON s.id=e.shipment_id WHERE s.order_id = ANY(?)"
                + " UNION ALL SELECT 'invoice', i.order_id, NULL, 'sent', i.sent_at FROM order_invoice i WHERE i.order_id = ANY(?) AND i.status='sent' AND i.sent_at IS NOT NULL", array, array, array))
            changes.computeIfAbsent((UUID) r.get("orderId"), k -> new ArrayList<>()).add(new OrderJourney.Change((String) r.get("source"), (String) r.get("fromStatus"), (String) r.get("toStatus"), (Instant) r.get("createdAt")));
        // the shopper's own request and the store's answer; the refunds, with their amount and how they were made
        for (var r : Jdbc.list(c, "SELECT order_id, 'requested' AS status, requested_at AS at, '' AS detail FROM order_cancellation_request WHERE order_id = ANY(?)"
                + " UNION ALL SELECT order_id, status, decided_at, answer FROM order_cancellation_request WHERE order_id = ANY(?) AND status<>'requested' AND decided_at IS NOT NULL", array, array))
            changes.computeIfAbsent((UUID) r.get("orderId"), k -> new ArrayList<>()).add(new OrderJourney.Change("cancel_request", null, (String) r.get("status"), (Instant) r.get("at"), (String) r.get("detail")));
        // a refund the store recorded is one step; one that moves money starts, may go to transfer, and ends
        for (var r : Jdbc.list(c, "SELECT r.order_id, r.amount, r.method, r.route, r.status, r.refunded_at, r.completed_at, r.updated_at,"
                + " EXISTS(SELECT 1 FROM refund_payout p WHERE p.order_id=r.order_id) AS has_account FROM order_refund r WHERE r.order_id = ANY(?)", array)) {
            var list = changes.computeIfAbsent((UUID) r.get("orderId"), k -> new ArrayList<>());
            String amount = dev.nortech.norpress.sales.domain.AfterSale.pesos((java.math.BigDecimal) r.get("amount"));
            String route = (String) r.get("route"), status = (String) r.get("status");
            String how = route.equals("manual") ? dev.nortech.norpress.sales.domain.AfterSale.Method.fromDb((String) r.get("method")).label : howOf(status.equals("succeeded") ? (String) r.get("method") : route);
            if (route.equals("manual")) { list.add(new OrderJourney.Change("refund", null, "done", (Instant) r.get("refundedAt"), amount + " " + how)); continue; }
            list.add(new OrderJourney.Change("refund", null, "started", (Instant) r.get("refundedAt"), amount + " " + howOf(route)));
            if (status.equals("to_transfer") && !route.equals("transfer"))
                list.add(new OrderJourney.Change("refund", null, "transfer", (Instant) r.get("updatedAt"),
                    Boolean.TRUE.equals(r.get("hasAccount")) ? "No se pudo por la pasarela; ya tenemos tu cuenta." : "No se pudo por la pasarela. Escribe en esta página la cuenta donde te lo consignamos."));
            if (status.equals("succeeded") && r.get("completedAt") != null) list.add(new OrderJourney.Change("refund", null, "done", (Instant) r.get("completedAt"), amount + " " + how));
        }
        var deliveries = new HashMap<UUID, OrderJourney.Delivery>();
        for (var r : Jdbc.list(c, "SELECT s.order_id, s.method, COALESCE(k.name, NULLIF(trim(s.carrier),'')) AS carrier, s.tracking_code FROM shipment s LEFT JOIN carrier k ON k.code=s.carrier_code WHERE s.order_id = ANY(?)", array))
            deliveries.put((UUID) r.get("orderId"), new OrderJourney.Delivery((String) r.get("method"), (String) r.get("carrier"), (String) r.get("trackingCode")));
        var out = new HashMap<UUID, List<OrderJourney.Step>>();
        changes.forEach((id, list) -> out.put(id, OrderJourney.of(list, deliveries.getOrDefault(id, OrderJourney.Delivery.NONE))));
        return out;
    }

    public void markSeen(Access access) {
        if (!usable(access)) return;
        Jdbc.with(db, c -> Jdbc.update(c, "UPDATE sales_order SET shopper_seen_at=now() WHERE number=?" + ALLOWED, allowed(access)));
    }
    public List<Map<String, Object>> news(UUID accountId, UUID customerId) {
        return owned(accountId, customerId, 50, 0).stream().filter(o -> Boolean.TRUE.equals(o.get("unseen")))
            .map(o -> { var m = new LinkedHashMap<String, Object>(); m.put("number", o.get("number")); m.put("step", o.get("latestStep")); m.put("at", o.get("latestAt")); return (Map<String, Object>) m; })
            .sorted(Comparator.comparing((Map<String, Object> m) -> (Instant) m.get("at")).reversed()).toList();
    }
    public java.util.Set<UUID> ownedIds(UUID accountId, UUID customerId) {
        return Jdbc.with(db, c -> Jdbc.list(c, "SELECT o.id FROM sales_order o WHERE o.account_id=? OR (?::uuid IS NOT NULL AND o.customer_id=?)", accountId, customerId, customerId)
            .stream().map(r -> (UUID) r.get("id")).collect(java.util.stream.Collectors.toSet()));
    }
    public Optional<Payable> payable(UUID id) { return Jdbc.with(db, c -> Jdbc.one(c, PAYABLE + " WHERE id=?", id).map(PostgresStorefrontOrders::payable)); }
    private static Payable payable(Map<String, Object> r) {
        return new Payable((UUID) r.get("id"), (String) r.get("number"), OrderStatus.fromDb((String) r.get("status")), (Boolean) r.get("test"), (BigDecimal) r.get("total"), (BigDecimal) r.get("taxTotal"), (BigDecimal) r.get("taxBase"), (String) r.get("paymentMethod"),
            texts(r.get("billing")), texts(r.get("shipping")), (Instant) r.get("expiresAt"));
    }
    private static Map<String, String> texts(Object json) {
        var out = new LinkedHashMap<String, String>();
        if (json instanceof JsonNode node && node.isObject()) node.fields().forEachRemaining(e -> { if (e.getValue().isValueNode()) out.put(e.getKey(), e.getValue().asText("")); });
        return out;
    }

    /** For the shopper, an order waiting for its invoice is simply delivered: invoicing is the store's own step. */
    private static final String SHOPPER_STAGE = "CASE WHEN sg.stage='to_invoice' THEN 'delivered' ELSE sg.stage END AS stage";

    public Optional<Map<String, Object>> view(Access access) {
        if (!usable(access)) return Optional.empty();
        return Jdbc.with(db, c -> {
            var found = Jdbc.one(c, "SELECT o.id, o.number, o.status, o.test, o.subtotal, o.shipping_total, (SELECT COALESCE(sum(d.amount + d.tax),0) FROM order_discount d WHERE d.order_id=o.id) AS discount, (SELECT d.code FROM order_discount d WHERE d.order_id=o.id LIMIT 1) AS coupon, o.tax_total, o.total, o.payment_method, o.payment_method_title, o.placed_at, o.paid_at, o.expires_at,"
                + " o.billing->>'first_name' AS first_name, o.billing->>'email' AS email, COALESCE(NULLIF(o.shipping->>'city',''), o.billing->>'city') AS city, o.shipping->>'address_1' AS address,"
                + " " + SHOPPER_STAGE + ", sg.delivery_method, (SELECT i.token FROM order_invoice i WHERE i.order_id=o.id AND i.status='sent') AS invoice_token, " + "(SELECT CASE WHEN k.link_template IS NOT NULL THEN replace(k.link_template,'{guia}',s.tracking_code) ELSE k.page_url END FROM shipment s JOIN carrier k ON k.code=s.carrier_code OR (s.carrier_code IS NULL AND (lower(k.name)=lower(trim(s.carrier)) OR lower(trim(s.carrier))=ANY(k.aliases))) WHERE s.order_id=o.id ORDER BY k.code=s.carrier_code DESC LIMIT 1) AS tracking_url, (SELECT k.link_template IS NOT NULL FROM shipment s JOIN carrier k ON k.code=s.carrier_code OR (s.carrier_code IS NULL AND (lower(k.name)=lower(trim(s.carrier)) OR lower(trim(s.carrier))=ANY(k.aliases))) WHERE s.order_id=o.id ORDER BY k.code=s.carrier_code DESC LIMIT 1) AS opens_guide, (SELECT v.tracking_code FROM v_delivery v WHERE v.order_id=o.id) AS tracking_code, (SELECT v.carrier FROM v_delivery v WHERE v.order_id=o.id) AS carrier"
                + " FROM sales_order o JOIN v_order_stage sg ON sg.order_id=o.id WHERE o.number=?" + ALLOWED.replace("public_token_hash", "o.public_token_hash").replace("account_id IS NULL", "o.account_id IS NULL").replace("account_id=", "o.account_id=").replace("customer_id=", "o.customer_id="), allowed(access));
            if (found.isEmpty()) return Optional.<Map<String, Object>>empty();
            var order = new LinkedHashMap<>(found.get());
            UUID id = (UUID) order.remove("id");
            // the shopper sees what they pay: line totals with tax
            order.put("lines", Jdbc.list(c, "SELECT l.title, l.quantity, round(l.subtotal * (1 + COALESCE(l.tax_rate_percent,0)/100)) AS total, p.slug, l.product_id, cv.image_id, cv.original_url AS image_url, COALESCE(cv.uploaded,false) AS image_uploaded"
                + " FROM order_line l LEFT JOIN product p ON p.id=l.product_id AND p.status='published' LEFT JOIN v_product_cover cv ON cv.product_id=l.product_id WHERE l.order_id=? ORDER BY l.id", id));
            order.put("journey", journeys(c, List.of(id)).getOrDefault(id, List.of()));
            // the shopper may cancel while the order has not left; the page asks for the details (how much, how) before
            boolean migrated = Jdbc.one(c, "SELECT source_key IS NOT NULL AS m FROM sales_order WHERE id=?", id).map(r -> Boolean.TRUE.equals(r.get("m"))).orElse(false);
            order.put("canCancel", !migrated && dev.nortech.norpress.sales.domain.AfterSale.canAskToCancel(
                dev.nortech.norpress.sales.domain.OrderStatus.fromDb((String) order.get("status")), String.valueOf(order.get("stage"))));
            order.put("refunded", Jdbc.one(c, "SELECT COALESCE(sum(amount),0) AS n FROM order_refund WHERE order_id=? AND status='succeeded'", id).map(r -> r.get("n")).orElse(java.math.BigDecimal.ZERO));
            // the refund in progress, if any: how it goes back and whether the store waits for the shopper's account
            order.put("refund", Jdbc.one(c, "SELECT r.amount, r.route, r.status, EXISTS(SELECT 1 FROM refund_payout p WHERE p.order_id=r.order_id) AS has_account"
                + " FROM order_refund r WHERE r.order_id=? AND r.status IN ('processing','checking','to_transfer')", id).orElse(null));
            order.put("shippingLabel", Jdbc.one(c, "SELECT label FROM order_shipping WHERE order_id=? LIMIT 1", id).map(r -> r.get("label")).orElse(null));
            // the carrier's own movements, when the store follows this guide automatically (fulfillment's tracking)
            var tracking = Jdbc.one(c, "SELECT t.shipment_id, t.stage, t.checked_at FROM shipment_tracking t JOIN shipment s ON s.id=t.shipment_id WHERE s.order_id=? AND t.state<>'rejected' AND t.number=s.tracking_code", id);
            order.put("tracking", tracking.map(t -> {
                var out = new LinkedHashMap<String, Object>(); out.put("stage", t.get("stage")); out.put("checkedAt", t.get("checkedAt"));
                try { out.put("events", Jdbc.list(c, "SELECT occurred_at AS at, description, location FROM shipment_tracking_event WHERE shipment_id=? ORDER BY occurred_at DESC LIMIT 60", t.get("shipmentId"))); }
                catch (java.sql.SQLException e) { throw new IllegalStateException(e); }
                return out;
            }).orElse(null));
            return Optional.<Map<String, Object>>of(order);
        });
    }
    private static String howOf(String routeOrMethod) {
        return switch (routeOrMethod) {
            case "wompi" -> dev.nortech.norpress.sales.domain.RefundRoute.WOMPI.label;
            case "payu" -> dev.nortech.norpress.sales.domain.RefundRoute.PAYU.label;
            case "gateway" -> "a tu medio de pago";
            default -> dev.nortech.norpress.sales.domain.RefundRoute.TRANSFER.label;
        };
    }
    public void recordPayment(UUID orderId, String provider, String externalId, String paymentType, BigDecimal amount, Instant paidAt, String sourceKey) {
        Jdbc.with(db, c -> {
            Jdbc.update(c, "INSERT INTO payment_transaction(id,order_id,provider,external_id,payment_type,status,amount,paid_at,source_key) VALUES(?,?,?,?,?,'approved',?,?,?) ON CONFLICT (source_key) DO NOTHING",
                UUID.randomUUID(), orderId, provider, externalId, paymentType, amount, paidAt, sourceKey);
            return Jdbc.update(c, "UPDATE sales_order SET paid_at=COALESCE(paid_at,?), expires_at=NULL, updated_at=now() WHERE id=?", paidAt, orderId);
        });
    }
    public void setPaymentMethod(UUID orderId, String method, String title) {
        Jdbc.with(db, c -> Jdbc.update(c, "UPDATE sales_order SET payment_method=?, payment_method_title=?, updated_at=now() WHERE id=?", method, title, orderId));
    }
    private static String json(Object value) {
        try { return JSON.writeValueAsString(value); } catch (JsonProcessingException e) { throw new IllegalStateException(e); }
    }
}

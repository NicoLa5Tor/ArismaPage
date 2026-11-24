package dev.nortech.norpress.fulfillment.adapter;
import dev.nortech.norpress.fulfillment.application.FulfillmentPorts.*;
import dev.nortech.norpress.fulfillment.domain.DeliveryMethod;
import dev.nortech.norpress.fulfillment.domain.FulfillmentStatus;
import dev.nortech.norpress.fulfillment.domain.Shipment;
import dev.nortech.norpress.shared.adapter.Jdbc;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import javax.sql.DataSource;
import java.time.Instant;
import java.util.*;

@ApplicationScoped
public class PostgresShipments implements ShipmentRepository, FulfillmentQueries {
    private static final String PAID = "('processing','completed','on_hold')", CLOSED = "('cancelled','failed','refunded')";
    private static final String LOCK = "SELECT s.id,s.method,s.status,s.carrier,s.tracking_code,s.courier_user_id,s.courier_name,s.recipient_name,s.failure_reason,s.packed_at,s.shipped_at,s.delivered_at,o.status AS order_status,o.payment_method"
        + " FROM sales_order o LEFT JOIN shipment s ON s.order_id=o.id WHERE o.id=? FOR UPDATE OF o";
    @Inject DataSource db;

    public Optional<Locked> lock(UUID orderId) {
        return Jdbc.with(db,c -> {
            var row = Jdbc.one(c,LOCK,orderId);
            if (row.isEmpty()) return Optional.<Locked>empty();
            if (row.get().get("id") == null) {
                // First touch of an order without delivery record: derive the method from the shipping line the customer chose.
                Jdbc.update(c,"INSERT INTO shipment(id,order_id,method,status) SELECT ?,o.id,CASE WHEN EXISTS(SELECT 1 FROM order_shipping x WHERE x.order_id=o.id AND x.method='local_pickup') THEN 'pickup' ELSE 'carrier' END,"
                    + "CASE WHEN o.status IN "+CLOSED+" THEN 'cancelled' ELSE 'pending' END FROM sales_order o WHERE o.id=?",UUID.randomUUID(),orderId);
                row = Jdbc.one(c,LOCK,orderId);
            }
            var r = row.get(); String orderStatus = (String) r.get("orderStatus");
            var shipment = new Shipment((UUID)r.get("id"),orderId,DeliveryMethod.parse((String)r.get("method")),FulfillmentStatus.fromDb((String)r.get("status")),(String)r.get("carrier"),(String)r.get("trackingCode"),
                (UUID)r.get("courierUserId"),(String)r.get("courierName"),(String)r.get("recipientName"),(String)r.get("failureReason"),(Instant)r.get("packedAt"),(Instant)r.get("shippedAt"),(Instant)r.get("deliveredAt"));
            return Optional.of(new Locked(shipment,new Shipment.OrderState(PAID.contains("'"+orderStatus+"'"),"cod".equals(r.get("paymentMethod")),CLOSED.contains("'"+orderStatus+"'"))));
        });
    }
    /** A courier chosen from the team keeps their name too, so history reads well even if the account is later removed. */
    public void save(Shipment s, UUID actor) {
        Jdbc.with(db,c -> Jdbc.update(c,"UPDATE shipment SET method=?,status=?,carrier=?,tracking_code=?,courier_user_id=?,courier_name=COALESCE((SELECT name FROM admin_user WHERE id=?),?),recipient_name=?,failure_reason=?,"
            + "packed_at=?,shipped_at=?,delivered_at=?,updated_at=now(),updated_by=? WHERE id=?",
            s.method().db(),s.status().db(),s.carrier(),s.trackingCode(),s.courierUserId(),s.courierUserId(),s.courierName(),s.recipientName(),s.failureReason(),s.packedAt(),s.shippedAt(),s.deliveredAt(),actor,s.id()));
    }
    public void recordEvent(UUID shipmentId, FulfillmentStatus from, FulfillmentStatus to, UUID actor, String note) {
        Jdbc.with(db,c -> Jdbc.update(c,"INSERT INTO shipment_event(id,shipment_id,from_status,to_status,actor_id,note) VALUES(?,?,?,?,?,?)",UUID.randomUUID(),shipmentId,from==null?null:from.db(),to.db(),actor,note==null?"":note));
    }
    public List<UUID> staleOrderIds(int days) {
        return Jdbc.with(db,c -> Jdbc.list(c,"SELECT o.id FROM v_order_stage s JOIN sales_order o ON o.id=s.order_id WHERE s.stage IN ('to_prepare','packed') AND o.status IN "+PAID+" AND o.placed_at<now()-make_interval(days=>?) ORDER BY o.placed_at",days)
            .stream().map(r -> (UUID)r.get("id")).toList());
    }

    private static final String CARD = "SELECT o.id AS order_id,o.number,s.status,s.method,s.carrier,s.tracking_code,COALESCE(u.name,s.courier_name) AS courier,s.failure_reason,s.updated_at,o.placed_at,o.total,o.status AS order_status,o.payment_method,"
        + "o.status IN "+PAID+" AS paid,NULLIF(trim(COALESCE(c.first_name,'')||' '||COALESCE(c.last_name,'')),'') AS customer_name,COALESCE(NULLIF(o.shipping->>'city',''),o.billing->>'city') AS city,o.billing->>'phone' AS phone,"
        + "(SELECT COALESCE(sum(l.quantity),0) FROM order_line l WHERE l.order_id=o.id) AS units,(SELECT count(*) FROM order_line l WHERE l.order_id=o.id) AS lines,"
        + "fl.product_id,cv.image_id,cv.original_url AS image_url,cv.uploaded AS image_uploaded"
        + ",sg.stage FROM v_delivery s JOIN sales_order o ON o.id=s.order_id JOIN v_order_stage sg ON sg.order_id=o.id LEFT JOIN customer c ON c.id=o.customer_id LEFT JOIN admin_user u ON u.id=s.courier_user_id"
        + " LEFT JOIN LATERAL (SELECT l.product_id FROM order_line l WHERE l.order_id=o.id AND l.product_id IS NOT NULL ORDER BY l.total DESC LIMIT 1) fl ON true LEFT JOIN v_product_cover cv ON cv.product_id=fl.product_id"
        + " WHERE sg.stage IN ('to_prepare','packed','shipped','issue') AND NOT sg.in_history AND (?='' OR s.method=?) AND (?='' OR o.number=? OR (c.first_name||' '||c.last_name) ILIKE ? OR COALESCE(o.shipping->>'city',o.billing->>'city') ILIKE ? OR s.tracking_code=?)";
    /** Open deliveries of paid (or cash-on-delivery) orders per column, oldest first (they have waited longest), capped per column; counts are exact. */
    public Map<String,Object> board(DeliveryMethod method, String query, int staleDays) {
        String m = method == null ? "" : method.db(), q = query == null ? "" : query.trim(), like = "%"+q+"%";
        return Jdbc.with(db,c -> {
            var cards = Jdbc.list(c,"SELECT * FROM (SELECT x.*,row_number() OVER (PARTITION BY x.stage ORDER BY x.placed_at) AS rn FROM ("+CARD+") x) y WHERE rn<=40 ORDER BY placed_at",m,m,q,q,like,like,q);
            var counts = new LinkedHashMap<String,Long>();
            for (var r : Jdbc.list(c,"SELECT x.stage,count(*) AS n FROM ("+CARD+") x GROUP BY x.stage",m,m,q,q,like,like,q)) counts.put((String)r.get("stage"),((Number)r.get("n")).longValue());
            long stale = Jdbc.count(c,"SELECT count(*) FROM v_order_stage sg JOIN sales_order o ON o.id=sg.order_id WHERE sg.stage IN ('to_prepare','packed') AND NOT sg.in_history AND o.status IN "+PAID+" AND o.placed_at<now()-make_interval(days=>?)",staleDays);
            var out = new LinkedHashMap<String,Object>(); out.put("cards",cards); out.put("counts",counts); out.put("stale",stale); out.put("staleDays",staleDays);
            out.put("deliveredToday",Jdbc.count(c,"SELECT count(*) FROM shipment WHERE status='delivered' AND delivered_at>=date_trunc('day',now() AT TIME ZONE 'America/Bogota') AT TIME ZONE 'America/Bogota'"));
            return out;
        });
    }
    public Optional<Map<String,Object>> shipment(UUID orderId) {
        return Jdbc.with(db,c -> {
            // Orders without a shipment row yet read as "pending" (see v_delivery); the row is created on the first step.
            var found = Jdbc.one(c,"SELECT s.id,d.method,d.status,s.carrier,s.tracking_code,s.carrier_code,COALESCE(s.follow,true) AS follow,"
                + "(SELECT CASE WHEN k.link_template IS NOT NULL THEN replace(k.link_template,'{guia}',s.tracking_code) ELSE k.page_url END FROM carrier k WHERE k.code=s.carrier_code OR (s.carrier_code IS NULL AND (lower(k.name)=lower(trim(s.carrier)) OR lower(trim(s.carrier))=ANY(k.aliases))) ORDER BY k.code=s.carrier_code DESC LIMIT 1) AS tracking_url,(SELECT k.link_template IS NOT NULL FROM carrier k WHERE k.code=s.carrier_code OR (s.carrier_code IS NULL AND (lower(k.name)=lower(trim(s.carrier)) OR lower(trim(s.carrier))=ANY(k.aliases))) ORDER BY k.code=s.carrier_code DESC LIMIT 1) AS opens_guide,"
                + "s.courier_user_id,COALESCE(u.name,s.courier_name) AS courier,s.recipient_name,s.failure_reason,s.packed_at,s.shipped_at,s.delivered_at,d.updated_at,b.name AS updated_by,"
                + "o.status IN "+PAID+" AS paid,o.payment_method='cod' AS cash_on_delivery FROM sales_order o JOIN v_delivery d ON d.order_id=o.id LEFT JOIN shipment s ON s.order_id=o.id LEFT JOIN admin_user u ON u.id=s.courier_user_id LEFT JOIN admin_user b ON b.id=s.updated_by WHERE o.id=?",orderId);
            if (found.isEmpty()) return Optional.<Map<String,Object>>empty();
            var out = new LinkedHashMap<>(found.get());
            out.put("tracking",out.get("id")==null?null:PostgresTracking.view(c,(UUID)out.get("id")));
            out.put("events",out.get("id")==null?List.of():Jdbc.list(c,"SELECT e.id,e.from_status,e.to_status,e.note,e.created_at,a.name AS actor FROM shipment_event e LEFT JOIN admin_user a ON a.id=e.actor_id WHERE e.shipment_id=? ORDER BY e.created_at DESC",out.get("id")));
            return Optional.<Map<String,Object>>of(out);
        });
    }
    public void setCarrier(UUID shipmentId, String carrierCode, boolean follow) {
        Jdbc.with(db,c -> Jdbc.update(c,"UPDATE shipment SET carrier_code=?,follow=? WHERE id=?",carrierCode,follow,shipmentId));
    }
    public List<Map<String,Object>> couriers() { return Jdbc.with(db,c -> Jdbc.list(c,"SELECT id,name,role FROM admin_user WHERE active ORDER BY lower(name)")); }
}

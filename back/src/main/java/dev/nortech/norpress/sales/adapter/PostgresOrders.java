package dev.nortech.norpress.sales.adapter;
import dev.nortech.norpress.sales.application.OrderQueries;
import dev.nortech.norpress.sales.application.OrderRepository;
import dev.nortech.norpress.sales.domain.OrderStatus;
import dev.nortech.norpress.shared.adapter.Jdbc;
import dev.nortech.norpress.shared.application.Page;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import javax.sql.DataSource;
import java.math.BigDecimal;
import java.util.*;

@ApplicationScoped
public class PostgresOrders implements OrderQueries, OrderRepository {
    // Stage and delivery come from the v_order_stage read model, which combines sales and deliveries (same database, read-only).
    private static final String SCOPE = " FROM sales_order o LEFT JOIN customer c ON c.id=o.customer_id JOIN v_order_stage sg ON sg.order_id=o.id WHERE (?::timestamptz IS NULL OR o.placed_at>=?) AND (?::timestamptz IS NULL OR o.placed_at<?)"
        + " AND (?='' OR o.number=? OR c.email ILIKE ? OR (c.first_name||' '||c.last_name) ILIKE ? OR o.billing->>'phone' ILIKE ?) AND sg.in_history=?";
    // "cancel_request" is not a delivery stage: it lists the orders whose shopper asked to cancel and wait for an answer
    private static final String FILTER = SCOPE + " AND (?='' OR o.status=?) AND (?='' OR sg.stage=ANY(string_to_array(?,','))"
        + " OR ('cancel_request'=ANY(string_to_array(?,',')) AND EXISTS(SELECT 1 FROM order_cancellation_request r WHERE r.order_id=o.id AND r.status='requested'))"
        // "refund_pending": orders whose money is still on its way back (to transfer, or to check in the gateway)
        + " OR ('refund_pending'=ANY(string_to_array(?,',')) AND EXISTS(SELECT 1 FROM order_refund r WHERE r.order_id=o.id AND r.status IN ('to_transfer','checking','processing'))))";
    @Inject DataSource db;

    public OrderList list(Filter f, Page.Request page) {
        String st=f.status()==null?"":f.status().db(), term=f.query()==null?"":f.query().trim(), like="%"+term+"%";
        var start=f.window()==null?null:f.window().start(); var end=f.window()==null?null:f.window().end();
        String dl=f.stage()==null?"":f.stage().trim();
        Object[] scope={start,start,end,end,term,term,like,like,like,f.history()}, p=concat(scope,st,st,dl,dl,dl,dl);
        return Jdbc.with(db,c -> {
            var items=Jdbc.list(c,"SELECT o.id,o.number,o.status,o.placed_at,o.total,o.payment_method,o.payment_method_title,c.id AS customer_id,NULLIF(trim(c.first_name||' '||c.last_name),'') AS customer_name,c.email AS customer_email,"
                + "(SELECT COALESCE(sum(l.quantity),0) FROM order_line l WHERE l.order_id=o.id) AS units,(SELECT s.label FROM order_shipping s WHERE s.order_id=o.id LIMIT 1) AS shipping,sg.stage,sg.delivery_status,sg.delivery_method,(SELECT v.tracking_code FROM v_delivery v WHERE v.order_id=o.id) AS tracking_code,COALESCE(NULLIF(o.shipping->>'city',''),o.billing->>'city') AS city"+FILTER+" ORDER BY o.placed_at DESC,o.id LIMIT ? OFFSET ?",concat(p,page.limit(),page.offset()));
            var totals=Jdbc.one(c,"SELECT count(*) AS n,COALESCE(sum(o.total),0) AS amount"+FILTER,p).orElseThrow();
            var stages=new LinkedHashMap<String,Long>();
            for(var r:Jdbc.list(c,"SELECT sg.stage,count(*) AS n"+SCOPE+" AND (?='' OR o.status=?) GROUP BY sg.stage",concat(scope,st,st))) stages.put((String)r.get("stage"),((Number)r.get("n")).longValue());
            return new OrderList(items,((Number)totals.get("n")).longValue(),(BigDecimal)totals.get("amount"),stages);
        });
    }
    public Optional<Map<String,Object>> detail(UUID id) {
        return Jdbc.with(db,c -> {
            var found=Jdbc.one(c,"SELECT id,number,status,currency,subtotal,discount_total,shipping_total,tax_total,total,prices_include_tax,payment_method,payment_method_title,created_via,placed_at,paid_at,completed_at,billing,shipping,customer_note,customer_id FROM sales_order WHERE id=?",id);
            if(found.isEmpty()) return Optional.<Map<String,Object>>empty();
            var order=new LinkedHashMap<>(found.get());
            Jdbc.one(c,"SELECT stage,delivery_status,delivery_method,in_history FROM v_order_stage WHERE order_id=?",id).ifPresent(order::putAll);
            // brought from the previous store: it lives in the history unless someone brought it back to the work list
            Jdbc.one(c,"SELECT source_key IS NOT NULL AS migrated,kept_active FROM sales_order WHERE id=?",id).ifPresent(order::putAll);
            order.put("customer",order.get("customerId")==null?null:Jdbc.one(c,"SELECT c.id,c.email,c.first_name,c.last_name,c.phone,c.document_type,c.document_number,c.has_account,s.orders,s.total_spent FROM customer c JOIN v_customer_stats s ON s.customer_id=c.id WHERE c.id=?",order.get("customerId")).orElse(null));
            order.put("lines",Jdbc.list(c,"SELECT l.id,l.product_id,l.sku,l.title,l.quantity,l.unit_price,l.subtotal,l.discount,l.tax,l.total,l.tax_rate_percent,l.stock_reduced,p.slug AS product_slug,p.title AS current_title,cv.image_id,cv.original_url AS image_url,cv.uploaded AS image_uploaded FROM order_line l LEFT JOIN product p ON p.id=l.product_id LEFT JOIN v_product_cover cv ON cv.product_id=l.product_id WHERE l.order_id=? ORDER BY l.source_key NULLS LAST,l.id",id));
            order.put("shippingLines",Jdbc.list(c,"SELECT id,method,label,cost,tax,tracking_code,carrier,picked_up_at FROM order_shipping WHERE order_id=?",id));
            order.put("discounts",Jdbc.list(c,"SELECT id,coupon_id,code,amount,tax FROM order_discount WHERE order_id=?",id));
            order.put("payments",Jdbc.list(c,"SELECT id,provider,external_id,payment_type,status,amount,paid_at FROM payment_transaction WHERE order_id=?",id));
            order.put("history",Jdbc.list(c,"SELECT h.id,h.from_status,h.to_status,h.note,h.created_at,a.email AS actor FROM order_status_history h LEFT JOIN admin_user a ON a.id=h.actor_id WHERE h.order_id=? ORDER BY h.created_at",id));
            order.put("notes",Jdbc.list(c,"SELECT id,body,author,customer_visible,created_at FROM order_note WHERE order_id=? ORDER BY created_at",id));
            order.put("quote",Jdbc.one(c,"SELECT id,number FROM quote_request WHERE order_id=?",id).orElse(null));
            // the invoice, if one was attached or the order does not need one (invoicing module)
            order.put("invoice",Jdbc.one(c,"SELECT status,number,file_name,array_to_string(channels,',') AS channels,sent_to,sent_at FROM order_invoice WHERE order_id=?",id).orElse(null));
            Jdbc.one(c,"SELECT o.test,o.expires_at,a.email AS account_email FROM sales_order o LEFT JOIN customer_account a ON a.id=o.account_id WHERE o.id=?",id).ifPresent(order::putAll);
            order.put("cancellations",Jdbc.list(c,"SELECT r.id,r.reason,r.status,r.answer,r.requested_at,r.decided_at,a.email AS decided_by FROM order_cancellation_request r LEFT JOIN admin_user a ON a.id=r.decided_by WHERE r.order_id=? ORDER BY r.requested_at DESC",id));
            order.put("paidAmount",Jdbc.one(c,"SELECT "+PostgresAfterSale.PAID+" AS n FROM sales_order o WHERE o.id=?",id).map(r -> r.get("n")).orElse(java.math.BigDecimal.ZERO));
            order.put("refunds",Jdbc.list(c,"SELECT r.id,r.amount,r.method,r.reference,r.note,r.refunded_at,r.route,r.status,r.requested_by,r.gateway_reference,r.failure,r.completed_at,a.email AS created_by FROM order_refund r LEFT JOIN admin_user a ON a.id=r.created_by WHERE r.order_id=? ORDER BY r.refunded_at",id));
            // only whether the shopper gave an account: its data is opened on purpose, and that opening is recorded
            order.put("refundAccount",Jdbc.one(c,"SELECT 1 AS n FROM refund_payout WHERE order_id=?",id).isPresent());
            order.put("attempts",Jdbc.list(c,"SELECT reference,gateway,amount,sandbox,status,external_id,detail,created_at,updated_at FROM payment_attempt WHERE order_id=? ORDER BY created_at DESC",id));
            return Optional.<Map<String,Object>>of(order);
        });
    }

    public Optional<OrderRef> lock(UUID id) {
        return Jdbc.with(db,c -> Jdbc.one(c,"SELECT number,status FROM sales_order WHERE id=? FOR UPDATE",id).map(r -> new OrderRef(id,(String)r.get("number"),OrderStatus.fromDb((String)r.get("status")))));
    }
    public void moveTo(UUID id, OrderStatus next) {
        Jdbc.with(db,c -> Jdbc.update(c,"UPDATE sales_order SET status=?,completed_at=CASE WHEN ?='completed' THEN now() ELSE completed_at END,updated_at=now() WHERE id=?",next.db(),next.db(),id));
    }
    public void keepActive(UUID id, boolean active) { Jdbc.with(db,c -> Jdbc.update(c,"UPDATE sales_order SET kept_active=?,updated_at=now() WHERE id=? AND source_key IS NOT NULL",active,id)); }
    public void recordHistory(UUID id, OrderStatus from, OrderStatus to, UUID actor, String note) {
        Jdbc.with(db,c -> Jdbc.update(c,"INSERT INTO order_status_history(id,order_id,from_status,to_status,actor_id,note) VALUES(?,?,?,?,?,?)",UUID.randomUUID(),id,from==null?null:from.db(),to.db(),actor,note));
    }
    public List<ReducedLine> lockReducedLines(UUID id) {
        return Jdbc.with(db,c -> Jdbc.list(c,"SELECT id,product_id,stock_reduced FROM order_line WHERE order_id=? AND stock_reduced>0 AND product_id IS NOT NULL FOR UPDATE",id).stream()
            .map(r -> new ReducedLine((UUID)r.get("id"),(UUID)r.get("productId"),((Number)r.get("stockReduced")).intValue())).toList());
    }
    public void markReduced(UUID lineId, int quantity) { Jdbc.with(db,c -> Jdbc.update(c,"UPDATE order_line SET stock_reduced=? WHERE id=?",quantity,lineId)); }
    public void markReturned(UUID lineId) { Jdbc.with(db,c -> Jdbc.update(c,"UPDATE order_line SET stock_reduced=0 WHERE id=?",lineId)); }
    public Map<String,Object> addNote(UUID id, String body, UUID actor) {
        UUID noteId=UUID.randomUUID();
        return Jdbc.with(db,c -> {
            Jdbc.update(c,"INSERT INTO order_note(id,order_id,body,author,actor_id) VALUES(?,?,?,(SELECT email FROM admin_user WHERE id=?),?)",noteId,id,body,actor,actor);
            return Jdbc.one(c,"SELECT id,body,author,customer_visible,created_at FROM order_note WHERE id=?",noteId).orElseThrow();
        });
    }
    private static Object[] concat(Object[] a,Object... b) { var out=Arrays.copyOf(a,a.length+b.length); System.arraycopy(b,0,out,a.length,b.length); return out; }
}

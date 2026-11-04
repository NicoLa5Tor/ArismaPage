package co.com.arisma.sales.adapter;
import co.com.arisma.sales.application.OrderQueries;
import co.com.arisma.sales.application.OrderRepository;
import co.com.arisma.sales.domain.OrderStatus;
import co.com.arisma.shared.adapter.Jdbc;
import co.com.arisma.shared.application.Page;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import javax.sql.DataSource;
import java.math.BigDecimal;
import java.util.*;

@ApplicationScoped
public class PostgresOrders implements OrderQueries, OrderRepository {
    // Stage and delivery come from the v_order_stage read model, which combines sales and deliveries (same database, read-only).
    private static final String SCOPE = " FROM sales_order o LEFT JOIN customer c ON c.id=o.customer_id JOIN v_order_stage sg ON sg.order_id=o.id WHERE (?::timestamptz IS NULL OR o.placed_at>=?) AND (?::timestamptz IS NULL OR o.placed_at<?)"
        + " AND (?='' OR o.number=? OR c.email ILIKE ? OR (c.first_name||' '||c.last_name) ILIKE ? OR o.billing->>'phone' ILIKE ?)";
    private static final String FILTER = SCOPE + " AND (?='' OR o.status=?) AND (?='' OR sg.stage=ANY(string_to_array(?,',')))";
    @Inject DataSource db;

    public OrderList list(Filter f, Page.Request page) {
        String st=f.status()==null?"":f.status().db(), term=f.query()==null?"":f.query().trim(), like="%"+term+"%";
        var start=f.window()==null?null:f.window().start(); var end=f.window()==null?null:f.window().end();
        String dl=f.stage()==null?"":f.stage().trim();
        Object[] scope={start,start,end,end,term,term,like,like,like}, p=concat(scope,st,st,dl,dl);
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
            Jdbc.one(c,"SELECT stage,delivery_status,delivery_method FROM v_order_stage WHERE order_id=?",id).ifPresent(order::putAll);
            order.put("customer",order.get("customerId")==null?null:Jdbc.one(c,"SELECT c.id,c.email,c.first_name,c.last_name,c.phone,c.document_type,c.document_number,c.has_account,s.orders,s.total_spent FROM customer c JOIN v_customer_stats s ON s.customer_id=c.id WHERE c.id=?",order.get("customerId")).orElse(null));
            order.put("lines",Jdbc.list(c,"SELECT l.id,l.product_id,l.sku,l.title,l.quantity,l.unit_price,l.subtotal,l.discount,l.tax,l.total,l.tax_rate_percent,l.stock_reduced,p.slug AS product_slug,p.title AS current_title,cv.image_id,cv.original_url AS image_url,cv.uploaded AS image_uploaded FROM order_line l LEFT JOIN product p ON p.id=l.product_id LEFT JOIN v_product_cover cv ON cv.product_id=l.product_id WHERE l.order_id=? ORDER BY l.source_key NULLS LAST,l.id",id));
            order.put("shippingLines",Jdbc.list(c,"SELECT id,method,label,cost,tax,tracking_code,carrier,picked_up_at FROM order_shipping WHERE order_id=?",id));
            order.put("discounts",Jdbc.list(c,"SELECT id,coupon_id,code,amount,tax FROM order_discount WHERE order_id=?",id));
            order.put("payments",Jdbc.list(c,"SELECT id,provider,external_id,payment_type,status,amount,paid_at FROM payment_transaction WHERE order_id=?",id));
            order.put("history",Jdbc.list(c,"SELECT h.id,h.from_status,h.to_status,h.note,h.created_at,a.email AS actor FROM order_status_history h LEFT JOIN admin_user a ON a.id=h.actor_id WHERE h.order_id=? ORDER BY h.created_at",id));
            order.put("notes",Jdbc.list(c,"SELECT id,body,author,customer_visible,created_at FROM order_note WHERE order_id=? ORDER BY created_at",id));
            order.put("quote",Jdbc.one(c,"SELECT id,number FROM quote_request WHERE order_id=?",id).orElse(null));
            return Optional.<Map<String,Object>>of(order);
        });
    }

    public Optional<OrderRef> lock(UUID id) {
        return Jdbc.with(db,c -> Jdbc.one(c,"SELECT number,status FROM sales_order WHERE id=? FOR UPDATE",id).map(r -> new OrderRef(id,(String)r.get("number"),OrderStatus.fromDb((String)r.get("status")))));
    }
    public void moveTo(UUID id, OrderStatus next) {
        Jdbc.with(db,c -> Jdbc.update(c,"UPDATE sales_order SET status=?,completed_at=CASE WHEN ?='completed' THEN now() ELSE completed_at END,updated_at=now() WHERE id=?",next.db(),next.db(),id));
    }
    public void recordHistory(UUID id, OrderStatus from, OrderStatus to, UUID actor, String note) {
        Jdbc.with(db,c -> Jdbc.update(c,"INSERT INTO order_status_history(id,order_id,from_status,to_status,actor_id,note) VALUES(?,?,?,?,?,?)",UUID.randomUUID(),id,from==null?null:from.db(),to.db(),actor,note));
    }
    public List<ReducedLine> lockReducedLines(UUID id) {
        return Jdbc.with(db,c -> Jdbc.list(c,"SELECT id,product_id,stock_reduced FROM order_line WHERE order_id=? AND stock_reduced>0 AND product_id IS NOT NULL FOR UPDATE",id).stream()
            .map(r -> new ReducedLine((UUID)r.get("id"),(UUID)r.get("productId"),((Number)r.get("stockReduced")).intValue())).toList());
    }
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

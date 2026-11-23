package co.com.arisma.reporting.adapter;
import co.com.arisma.reporting.application.ReportQueries;
import co.com.arisma.shared.adapter.Jdbc;
import co.com.arisma.shared.domain.DateWindow;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import javax.sql.DataSource;
import java.util.*;

@ApplicationScoped
public class PostgresReports implements ReportQueries {
    private static final String TOTALS = "SELECT count(*) AS orders,COALESCE(sum(o.total),0) AS sales,COALESCE(round(avg(o.total)),0) AS avg_ticket,COALESCE(sum(o.tax_total),0) AS tax,COALESCE(sum(o.shipping_total),0) AS shipping,COALESCE(sum(o.discount_total),0) AS discount,"
        + "COALESCE((SELECT sum(l.quantity) FROM order_line l JOIN v_paid_order x ON x.id=l.order_id WHERE x.placed_at>=? AND x.placed_at<?),0) AS units FROM v_paid_order o WHERE o.placed_at>=? AND o.placed_at<?";
    @Inject DataSource db;

    public Map<String,Object> totals(DateWindow w) { return Jdbc.with(db,c -> Jdbc.one(c,TOTALS,w.start(),w.end(),w.start(),w.end()).orElseThrow()); }
    public long newCustomers(DateWindow w) {
        return Jdbc.with(db,c -> Jdbc.count(c,"SELECT count(*) FROM (SELECT customer_id,min(placed_at) AS first_at FROM v_paid_order WHERE customer_id IS NOT NULL GROUP BY customer_id) f WHERE f.first_at>=? AND f.first_at<?",w.start(),w.end()));
    }
    public Map<String,Object> queue(int threshold) {
        return Jdbc.with(db,c -> Jdbc.one(c,"SELECT (SELECT count(*) FROM sales_order WHERE status='processing') AS processing,(SELECT count(*) FROM sales_order WHERE status='on_hold') AS on_hold,(SELECT count(*) FROM sales_order WHERE status='pending') AS pending,"
            + "(SELECT count(*) FROM quote_request WHERE status='pending' AND (expires_at IS NULL OR expires_at>=now())) AS open_quotes,(SELECT count(*) FROM product WHERE status='published' AND manage_stock AND stock_quantity<=?) AS low_stock,"
            // only the work list counts: orders from the previous store live in the history
            + "(SELECT count(*) FROM v_order_stage WHERE stage IN ('to_prepare','packed') AND NOT in_history) AS to_dispatch,(SELECT count(*) FROM v_order_stage WHERE stage='shipped' AND NOT in_history) AS in_transit,"
            + "(SELECT count(*) FROM v_order_stage WHERE stage='issue' AND NOT in_history) AS issues,(SELECT count(*) FROM v_order_stage WHERE stage='unpaid' AND NOT in_history) AS unpaid,"
            + "(SELECT count(*) FROM product_post WHERE status='pending')+(SELECT count(*) FROM product_post_reply WHERE status='pending') AS reviews_pending,"
            + "(SELECT count(*) FROM sales_order WHERE status='pending' AND created_via='storefront' AND NOT test) AS store_unpaid",threshold).orElseThrow());
    }
    public List<Map<String,Object>> salesByMonth(DateWindow w) {
        return Jdbc.with(db,c -> Jdbc.list(c,"WITH months AS (SELECT generate_series(date_trunc('month',?::timestamptz AT TIME ZONE 'America/Bogota'),date_trunc('month',(?::timestamptz - interval '1 second') AT TIME ZONE 'America/Bogota'),interval '1 month') AS m)"
            + " SELECT to_char(m.m,'YYYY-MM') AS month,count(o.id) AS orders,COALESCE(sum(o.total),0) AS sales FROM months m LEFT JOIN v_paid_order o ON date_trunc('month',o.placed_at AT TIME ZONE 'America/Bogota')=m.m AND o.placed_at>=? AND o.placed_at<? GROUP BY m.m ORDER BY m.m",
            w.start(),w.end(),w.start(),w.end()));
    }
    public List<Map<String,Object>> topProducts(DateWindow w, int limit, boolean byRevenue) {
        return Jdbc.with(db,c -> Jdbc.list(c,"SELECT l.product_id,COALESCE(p.title,max(l.title)) AS title,p.sku,sum(l.quantity) AS units,sum(l.total) AS net,count(DISTINCT l.order_id) AS orders,p.stock_quantity,cv.image_id,cv.original_url AS image_url,cv.uploaded AS image_uploaded FROM order_line l JOIN v_paid_order o ON o.id=l.order_id LEFT JOIN product p ON p.id=l.product_id LEFT JOIN v_product_cover cv ON cv.product_id=l.product_id"
            + " WHERE o.placed_at>=? AND o.placed_at<? GROUP BY l.product_id,p.title,p.sku,p.stock_quantity,cv.image_id,cv.original_url,cv.uploaded ORDER BY "+(byRevenue?"net":"units")+" DESC LIMIT ?",w.start(),w.end(),Math.clamp(limit,1,50)));
    }
    public List<Map<String,Object>> paymentMethods(DateWindow w) {
        return Jdbc.with(db,c -> Jdbc.list(c,"SELECT COALESCE(o.payment_method,'sin_metodo') AS method,COALESCE(max(o.payment_method_title),max(o.payment_method),'Sin método') AS title,count(*) AS orders,sum(o.total) AS sales FROM v_paid_order o WHERE o.placed_at>=? AND o.placed_at<? GROUP BY 1 ORDER BY sales DESC",w.start(),w.end()));
    }
    public List<Map<String,Object>> shippingMethods(DateWindow w) {
        return Jdbc.with(db,c -> Jdbc.list(c,"SELECT s.method,max(s.label) AS label,count(*) AS orders,sum(s.cost) AS cost FROM order_shipping s JOIN v_paid_order o ON o.id=s.order_id WHERE o.placed_at>=? AND o.placed_at<? GROUP BY s.method ORDER BY orders DESC",w.start(),w.end()));
    }
    public List<Map<String,Object>> orderStatuses(DateWindow w) {
        return Jdbc.with(db,c -> Jdbc.list(c,"SELECT status,count(*) AS orders,sum(total) AS amount FROM sales_order WHERE NOT test AND placed_at>=? AND placed_at<? GROUP BY status ORDER BY orders DESC",w.start(),w.end()));
    }
}

package co.com.arisma.customers.adapter;
import co.com.arisma.customers.application.CustomerQueries;
import co.com.arisma.shared.adapter.Jdbc;
import co.com.arisma.shared.application.Page;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import javax.sql.DataSource;
import java.util.*;

@ApplicationScoped
public class PostgresCustomers implements CustomerQueries {
    private static final String FILTER = " FROM customer c JOIN v_customer_stats s ON s.customer_id=c.id WHERE (?='' OR c.email ILIKE ? OR (c.first_name||' '||c.last_name) ILIKE ? OR c.phone ILIKE ? OR c.document_number=?) AND (NOT ? OR s.orders>0)";
    private static final Map<Sort,String> ORDER = Map.of(Sort.RECENT,"s.last_order_at DESC NULLS LAST",Sort.SPENT,"s.total_spent DESC",Sort.ORDERS,"s.orders DESC",Sort.NAME,"lower(c.last_name),lower(c.first_name)");
    @Inject DataSource db;

    public Page list(String query, boolean buyersOnly, Sort sort, Page.Request page) {
        String term=query==null?"":query.trim(), like="%"+term+"%"; Object[] p={term,like,like,like,term,buyersOnly};
        return Jdbc.with(db,c -> new Page(Jdbc.list(c,"SELECT c.id,c.email,c.first_name,c.last_name,c.phone,c.has_account,c.created_at,s.orders,s.total_spent,s.last_order_at,(SELECT a.city FROM address a WHERE a.customer_id=c.id ORDER BY a.kind LIMIT 1) AS city"
            + FILTER+" ORDER BY "+ORDER.get(sort)+",c.id LIMIT ? OFFSET ?",term,like,like,like,term,buyersOnly,page.limit(),page.offset()), Jdbc.count(c,"SELECT count(*)"+FILTER,p)));
    }
    public Optional<Map<String,Object>> detail(UUID id) {
        return Jdbc.with(db,c -> {
            var found=Jdbc.one(c,"SELECT c.id,c.email,c.first_name,c.last_name,c.phone,c.document_type,c.document_number,c.company,c.has_account,c.created_at,s.orders AS paid_orders,s.total_spent,s.last_order_at FROM customer c JOIN v_customer_stats s ON s.customer_id=c.id WHERE c.id=?",id);
            if(found.isEmpty()) return Optional.<Map<String,Object>>empty();
            var customer=new LinkedHashMap<>(found.get());
            customer.put("addresses",Jdbc.list(c,"SELECT kind,first_name,last_name,line1,line2,city,state,postcode,country,phone FROM address WHERE customer_id=? ORDER BY kind",id));
            customer.put("orders",Jdbc.list(c,"SELECT o.id,o.number,o.status,o.placed_at,o.total,o.payment_method,(SELECT COALESCE(sum(l.quantity),0) FROM order_line l WHERE l.order_id=o.id) AS units FROM sales_order o WHERE o.customer_id=? ORDER BY o.placed_at DESC",id));
            customer.put("quotes",Jdbc.list(c,"SELECT id,number,status,created_at,total FROM quote_request WHERE customer_id=? ORDER BY created_at DESC",id));
            customer.put("topProducts",Jdbc.list(c,"SELECT l.product_id,max(l.title) AS title,sum(l.quantity) AS units,sum(l.total) AS total,max(cv.image_id::text)::uuid AS image_id,max(cv.original_url) AS image_url,bool_or(cv.uploaded) AS image_uploaded FROM order_line l JOIN v_paid_order o ON o.id=l.order_id LEFT JOIN v_product_cover cv ON cv.product_id=l.product_id WHERE o.customer_id=? GROUP BY l.product_id ORDER BY units DESC LIMIT 5",id));
            return Optional.<Map<String,Object>>of(customer);
        });
    }
}

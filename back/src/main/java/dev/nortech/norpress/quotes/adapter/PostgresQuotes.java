package dev.nortech.norpress.quotes.adapter;
import dev.nortech.norpress.quotes.application.QuoteQueries;
import dev.nortech.norpress.quotes.application.QuoteRepository;
import dev.nortech.norpress.quotes.domain.QuoteStatus;
import dev.nortech.norpress.shared.adapter.Jdbc;
import dev.nortech.norpress.shared.application.Page;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import javax.sql.DataSource;
import java.util.*;

@ApplicationScoped
public class PostgresQuotes implements QuoteQueries, QuoteRepository {
    private static final String FILTER = " FROM quote_request r WHERE (?='' OR r.status=?) AND (?='' OR r.number ILIKE ? OR r.email ILIKE ? OR r.name ILIKE ?)";
    @Inject DataSource db;

    public Page list(QuoteStatus status, String query, Page.Request page) {
        String st=status==null?"":status.db(), term=query==null?"":query.trim(), like="%"+term+"%"; Object[] p={st,st,term,like,like,like};
        return Jdbc.with(db,c -> new Page(Jdbc.list(c,"SELECT r.id,r.number,r.status,r.name,r.email,r.created_at,r.expires_at,r.total,r.order_id,(SELECT o.number FROM sales_order o WHERE o.id=r.order_id) AS order_number,"
            + "(SELECT COALESCE(sum(l.quantity),0) FROM quote_line l WHERE l.quote_id=r.id) AS units,(r.status='pending' AND r.expires_at<now()) AS overdue"+FILTER+" ORDER BY r.created_at DESC,r.id LIMIT ? OFFSET ?",
            st,st,term,like,like,like,page.limit(),page.offset()), Jdbc.count(c,"SELECT count(*)"+FILTER,p)));
    }
    public Optional<Map<String,Object>> detail(UUID id) {
        return Jdbc.with(db,c -> {
            var found=Jdbc.one(c,"SELECT r.id,r.number,r.status,r.name,r.email,r.message,r.customer_id,r.order_id,(SELECT o.number FROM sales_order o WHERE o.id=r.order_id) AS order_number,r.subtotal,r.tax_total,r.total,r.created_at,r.expires_at,(r.status='pending' AND r.expires_at<now()) AS overdue,r.source_metadata->'meta'->>'_billing_phone' AS phone FROM quote_request r WHERE r.id=?",id);
            if(found.isEmpty()) return Optional.<Map<String,Object>>empty();
            var quote=new LinkedHashMap<>(found.get());
            quote.put("lines",Jdbc.list(c,"SELECT l.id,l.product_id,l.sku,l.title,l.quantity,l.unit_price,l.total,p.slug AS product_slug,p.stock_quantity,p.manage_stock,p.stock_status,cv.image_id,cv.original_url AS image_url,cv.uploaded AS image_uploaded FROM quote_line l LEFT JOIN product p ON p.id=l.product_id LEFT JOIN v_product_cover cv ON cv.product_id=l.product_id WHERE l.quote_id=? ORDER BY l.source_key NULLS LAST,l.id",id));
            quote.put("notes",Jdbc.list(c,"SELECT id,body,author,created_at FROM order_note WHERE quote_id=? ORDER BY created_at",id));
            return Optional.<Map<String,Object>>of(quote);
        });
    }
    public Optional<QuoteStatus> lockStatus(UUID id) { return Jdbc.with(db,c -> Jdbc.one(c,"SELECT status FROM quote_request WHERE id=? FOR UPDATE",id).map(r -> QuoteStatus.parse((String)r.get("status")))); }
    public void updateStatus(UUID id, QuoteStatus status) { Jdbc.with(db,c -> Jdbc.update(c,"UPDATE quote_request SET status=?,updated_at=now() WHERE id=?",status.db(),id)); }
    public void addNote(UUID id, String body, UUID actor) { Jdbc.with(db,c -> Jdbc.update(c,"INSERT INTO order_note(id,quote_id,body,author,actor_id) VALUES(?,?,?,(SELECT email FROM admin_user WHERE id=?),?)",UUID.randomUUID(),id,body,actor,actor)); }
}

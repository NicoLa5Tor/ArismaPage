package dev.nortech.norpress.invoicing.adapter;
import dev.nortech.norpress.invoicing.application.InvoiceRepository;
import dev.nortech.norpress.invoicing.domain.Invoice;
import dev.nortech.norpress.shared.adapter.Jdbc;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import javax.sql.DataSource;
import java.util.*;

@ApplicationScoped
public class PostgresInvoices implements InvoiceRepository {
    private static final String COLUMNS = "SELECT status,number,file_name,object_key,token,array_to_string(channels,',') AS channels FROM order_invoice ";
    @Inject DataSource db;

    public Optional<OrderFacts> order(UUID orderId) {
        return Jdbc.with(db, c -> Jdbc.one(c, "SELECT o.number,o.status,NULLIF(trim(COALESCE(o.billing->>'first_name',c.first_name,'')||' '||COALESCE(o.billing->>'last_name',c.last_name,'')),'') AS name,"
            + "COALESCE(NULLIF(o.billing->>'email',''),c.email) AS email FROM sales_order o LEFT JOIN customer c ON c.id=o.customer_id WHERE o.id=?", orderId)
            .map(r -> new OrderFacts(orderId, (String) r.get("number"), (String) r.get("status"), (String) r.get("name"), (String) r.get("email"))));
    }
    public Optional<Invoice> find(UUID orderId) { return Jdbc.with(db, c -> Jdbc.one(c, COLUMNS + "WHERE order_id=?", orderId).map(PostgresInvoices::invoice)); }
    public Optional<Invoice> byToken(String token) { return Jdbc.with(db, c -> Jdbc.one(c, COLUMNS + "WHERE token=? AND status<>'not_needed'", token).map(PostgresInvoices::invoice)); }

    public void saveUploaded(UUID orderId, String number, String objectKey, String fileName, int size, String token, UUID actor) {
        Jdbc.with(db, c -> Jdbc.update(c, "INSERT INTO order_invoice(order_id,status,number,object_key,file_name,size_bytes,token,uploaded_at,uploaded_by) VALUES(?,'uploaded',?,?,?,?,?,now(),?)"
            + " ON CONFLICT (order_id) DO UPDATE SET status='uploaded',number=excluded.number,object_key=excluded.object_key,file_name=excluded.file_name,size_bytes=excluded.size_bytes,token=excluded.token,"
            + "channels='{}',sent_to=NULL,sent_at=NULL,sent_by=NULL,uploaded_at=now(),uploaded_by=excluded.uploaded_by,updated_at=now()", orderId, number, objectKey, fileName, size, token, actor));
    }
    public void markSent(UUID orderId, String channel, String to, UUID actor) {
        Jdbc.with(db, c -> Jdbc.update(c, "UPDATE order_invoice SET status='sent',channels=CASE WHEN ?=ANY(channels) THEN channels ELSE array_append(channels,?::text) END,"
            + "sent_to=COALESCE(?,sent_to),sent_at=now(),sent_by=?,updated_at=now() WHERE order_id=?", channel, channel, to, actor, orderId));
    }
    public void markNotNeeded(UUID orderId, UUID actor) {
        Jdbc.with(db, c -> Jdbc.update(c, "INSERT INTO order_invoice(order_id,status,sent_by,updated_at) VALUES(?,'not_needed',?,now())"
            + " ON CONFLICT (order_id) DO UPDATE SET status='not_needed',sent_by=excluded.sent_by,updated_at=now()", orderId, actor));
    }

    private static Invoice invoice(Map<String, Object> r) {
        var channels = (String) r.get("channels");
        return new Invoice(Invoice.Status.fromDb((String) r.get("status")), (String) r.get("number"), (String) r.get("fileName"), (String) r.get("objectKey"), (String) r.get("token"),
            channels == null || channels.isEmpty() ? List.of() : List.of(channels.split(",")));
    }
}

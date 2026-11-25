package dev.nortech.norpress.customers.adapter;
import dev.nortech.norpress.customers.application.ShopperPorts.AccountData;
import dev.nortech.norpress.shared.adapter.Jdbc;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.*;
import javax.sql.DataSource;

/** A shopper's own data, read for them and erased at their request, in PostgreSQL. */
@ApplicationScoped
public class PostgresAccountData implements AccountData {
    @Inject DataSource db;

    public Map<String, Object> export(UUID accountId, UUID customerId) {
        return Jdbc.with(db, c -> {
            var out = new LinkedHashMap<String, Object>();
            out.put("account", Jdbc.one(c, "SELECT name, email, email_verified, created_at, last_login_at FROM customer_account WHERE id=?", accountId).orElse(Map.of()));
            out.put("profile", Jdbc.one(c, "SELECT first_name, last_name, email, phone, document_type, document_number, company FROM customer WHERE id=?", customerId).orElse(Map.of()));
            out.put("addresses", Jdbc.list(c, "SELECT label, recipient, phone, state, city, neighborhood, street, detail, instructions, is_default FROM customer_address WHERE customer_id=? ORDER BY created_at", customerId));
            var orders = new ArrayList<Map<String, Object>>();
            for (var o : Jdbc.list(c, "SELECT id, number, placed_at, status, total, payment_method_title FROM sales_order WHERE account_id=? OR customer_id=? ORDER BY placed_at DESC", accountId, customerId)) {
                var order = new LinkedHashMap<>(o);
                order.remove("id");
                order.put("lines", Jdbc.list(c, "SELECT title, quantity, total FROM order_line WHERE order_id=? ORDER BY title", o.get("id")));
                orders.add(order);
            }
            out.put("orders", orders);
            out.put("reviews", Jdbc.list(c, "SELECT kind, body, created_at FROM product_post WHERE account_id=? ORDER BY created_at DESC", accountId));
            return out;
        });
    }
    public List<String> unfinishedOrders(UUID accountId) {
        return Jdbc.with(db, c -> Jdbc.list(c, "SELECT o.number FROM sales_order o JOIN v_order_stage s ON s.order_id=o.id WHERE o.account_id=? AND o.source_key IS NULL"
            + " AND (s.stage NOT IN ('delivered','to_invoice','cancelled') OR EXISTS(SELECT 1 FROM order_refund r WHERE r.order_id=o.id AND r.status IN ('processing','checking','to_transfer')))"
            + " ORDER BY o.placed_at", accountId).stream().map(r -> (String) r.get("number")).toList());
    }
    public void erase(UUID accountId, UUID customerId) {
        Jdbc.with(db, c -> {
            var email = Jdbc.one(c, "SELECT email FROM customer_account WHERE id=?", accountId).map(r -> (String) r.get("email")).orElse(null);
            // sessions and one-time links go with the account (ON DELETE CASCADE); orders, reviews and acceptances keep no link to it
            Jdbc.update(c, "DELETE FROM customer_account WHERE id=?", accountId);
            Jdbc.update(c, "DELETE FROM customer_address WHERE customer_id=?", customerId);
            Jdbc.update(c, "DELETE FROM address WHERE customer_id=?", customerId);
            Jdbc.update(c, "DELETE FROM refund_payout WHERE order_id IN (SELECT id FROM sales_order WHERE customer_id=?)", customerId);
            Jdbc.update(c, "UPDATE customer SET email=NULL, first_name='Cuenta eliminada', last_name='', phone=NULL, document_type=NULL, document_number=NULL, company=NULL, has_account=false, updated_at=now() WHERE id=?", customerId);
            // the copies of the emails sent to them keep only who and when
            if (email != null) Jdbc.update(c, "UPDATE mail_outbox SET body_text='', body_html='' WHERE lower(recipient)=lower(?) AND status IN ('sent','stored','failed')", email);
            return 1;
        });
    }
}

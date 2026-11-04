package co.com.arisma.promotions.adapter;
import co.com.arisma.promotions.application.CouponRepository;
import co.com.arisma.promotions.domain.Coupon;
import co.com.arisma.shared.adapter.Jdbc;
import co.com.arisma.shared.domain.Conflict;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import javax.sql.DataSource;
import java.util.*;

@ApplicationScoped
public class PostgresCoupons implements CouponRepository {
    private static final String USES = "(SELECT count(*) FROM order_discount d JOIN v_paid_order o ON o.id=d.order_id WHERE d.coupon_id=k.id)";
    private static final String SELECT = "SELECT k.id,k.code,k.kind,k.amount,k.minimum_amount,k.maximum_amount,k.usage_limit,k.usage_limit_per_customer,k.individual_use,k.free_shipping,k.exclude_sale_items,k.expires_at,k.active,k.description,"
        + USES+" AS uses,(SELECT COALESCE(sum(d.amount),0) FROM order_discount d JOIN v_paid_order o ON o.id=d.order_id WHERE d.coupon_id=k.id) AS discounted,"
        + "(k.active AND (k.expires_at IS NULL OR k.expires_at>now()) AND (k.usage_limit IS NULL OR k.usage_limit>"+USES+")) AS redeemable FROM coupon k";
    private static final String COLUMNS = "code=?,kind=?,amount=?,minimum_amount=?,maximum_amount=?,usage_limit=?,usage_limit_per_customer=?,individual_use=?,free_shipping=?,exclude_sale_items=?,expires_at=?,active=?,description=?";
    @Inject DataSource db;

    public List<Map<String,Object>> list() { return Jdbc.with(db,c -> Jdbc.list(c,SELECT+" ORDER BY k.active DESC,k.created_at DESC")); }
    public Optional<Map<String,Object>> find(UUID id) { return Jdbc.with(db,c -> Jdbc.one(c,SELECT+" WHERE k.id=?",id)); }
    public void insert(Coupon k) { write("INSERT INTO coupon(code,kind,amount,minimum_amount,maximum_amount,usage_limit,usage_limit_per_customer,individual_use,free_shipping,exclude_sale_items,expires_at,active,description,id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",k); }
    public boolean update(Coupon k) { return write("UPDATE coupon SET "+COLUMNS+",updated_at=now() WHERE id=?",k)>0; }
    private int write(String sql, Coupon k) {
        try { return Jdbc.with(db,c -> Jdbc.update(c,sql,k.code(),k.kind().db(),k.amount(),k.minimumAmount(),k.maximumAmount(),k.usageLimit(),k.usageLimitPerCustomer(),k.individualUse(),k.freeShipping(),k.excludeSaleItems(),k.expiresAt(),k.active(),k.description(),k.id())); }
        catch(IllegalStateException e) { if(Jdbc.duplicate(e)) throw new Conflict("Ya existe un cupón con ese código"); throw e; }
    }
}

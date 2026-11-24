package dev.nortech.norpress.promotions.adapter;
import dev.nortech.norpress.promotions.application.CouponRepository;
import dev.nortech.norpress.promotions.domain.Coupon;
import dev.nortech.norpress.shared.adapter.Jdbc;
import dev.nortech.norpress.shared.domain.Conflict;
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
    public Optional<Coupon> findByCode(String code) {
        return Jdbc.with(db,c -> Jdbc.one(c,"SELECT id,code,kind,amount,minimum_amount,maximum_amount,usage_limit,usage_limit_per_customer,individual_use,free_shipping,exclude_sale_items,expires_at,active,description FROM coupon WHERE lower(code)=lower(?)",code)
            .map(r -> new Coupon((UUID)r.get("id"),(String)r.get("code"),Coupon.Kind.valueOf(((String)r.get("kind")).toUpperCase(Locale.ROOT)),(java.math.BigDecimal)r.get("amount"),(java.math.BigDecimal)r.get("minimumAmount"),(java.math.BigDecimal)r.get("maximumAmount"),
                (Integer)r.get("usageLimit"),(Integer)r.get("usageLimitPerCustomer"),(Boolean)r.get("individualUse"),(Boolean)r.get("freeShipping"),(Boolean)r.get("excludeSaleItems"),(java.time.Instant)r.get("expiresAt"),(Boolean)r.get("active"),(String)r.get("description"))));
    }
    public long usesHeld(UUID couponId, String email) {
        return Jdbc.with(db,c -> Jdbc.count(c,"SELECT count(DISTINCT o.id) AS n FROM order_discount d JOIN sales_order o ON o.id=d.order_id WHERE d.coupon_id=? AND o.status NOT IN ('cancelled','failed','refunded') AND (?::text IS NULL OR lower(o.billing->>'email')=lower(?))",couponId,email,email));
    }
    public void insert(Coupon k) { write("INSERT INTO coupon(code,kind,amount,minimum_amount,maximum_amount,usage_limit,usage_limit_per_customer,individual_use,free_shipping,exclude_sale_items,expires_at,active,description,id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",k); }
    public boolean update(Coupon k) { return write("UPDATE coupon SET "+COLUMNS+",updated_at=now() WHERE id=?",k)>0; }
    private int write(String sql, Coupon k) {
        try { return Jdbc.with(db,c -> Jdbc.update(c,sql,k.code(),k.kind().db(),k.amount(),k.minimumAmount(),k.maximumAmount(),k.usageLimit(),k.usageLimitPerCustomer(),k.individualUse(),k.freeShipping(),k.excludeSaleItems(),k.expiresAt(),k.active(),k.description(),k.id())); }
        catch(IllegalStateException e) { if(Jdbc.duplicate(e)) throw new Conflict("Ya existe un cupón con ese código"); throw e; }
    }
}

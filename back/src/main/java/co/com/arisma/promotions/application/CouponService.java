package co.com.arisma.promotions.application;
import co.com.arisma.promotions.domain.Coupon;
import co.com.arisma.shared.domain.NotFound;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import java.util.Map;

/** Coupon use cases. Validation lives in the Coupon domain record. */
@ApplicationScoped
public class CouponService {
    @Inject CouponRepository coupons;
    @Transactional
    public Map<String, Object> create(Coupon coupon) { coupons.insert(coupon); return coupons.find(coupon.id()).orElseThrow(); }
    @Transactional
    public Map<String, Object> update(Coupon coupon) {
        if (!coupons.update(coupon)) throw new NotFound("Cupón no encontrado");
        return coupons.find(coupon.id()).orElseThrow();
    }
}

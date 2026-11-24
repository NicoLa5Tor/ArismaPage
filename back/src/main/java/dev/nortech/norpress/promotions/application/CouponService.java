package dev.nortech.norpress.promotions.application;
import dev.nortech.norpress.promotions.domain.Coupon;
import dev.nortech.norpress.shared.domain.NotFound;
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

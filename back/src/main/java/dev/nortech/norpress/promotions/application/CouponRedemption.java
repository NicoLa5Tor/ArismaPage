package dev.nortech.norpress.promotions.application;
import dev.nortech.norpress.promotions.domain.Coupon;
import dev.nortech.norpress.promotions.domain.Redemption;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.Clock;
import java.util.List;

/** What the checkout asks the promotions module: does this code apply to this cart, and for how much. */
@ApplicationScoped
public class CouponRedemption {
    @Inject CouponRepository coupons;
    Clock clock = Clock.systemUTC();

    /** email is the buyer's, for the per-customer limit; null while it is not known yet (the cart page). */
    public Redemption.Result apply(String code, List<Redemption.CartLine> lines, String email) {
        String clean = code == null ? "" : code.trim();
        if (clean.isEmpty() || clean.length() > 40) throw new IllegalArgumentException("Escribe el código del cupón");
        Coupon coupon = coupons.findByCode(clean).orElseThrow(() -> new IllegalArgumentException("Ese cupón no existe"));
        return Redemption.apply(coupon, lines, coupons.usesHeld(coupon.id(), null), email == null || email.isBlank() ? 0 : coupons.usesHeld(coupon.id(), email.trim()), clock.instant());
    }
}

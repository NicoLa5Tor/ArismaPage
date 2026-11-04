package co.com.arisma.promotions.domain;
import static org.junit.jupiter.api.Assertions.*;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
class CouponTest {
    private static Coupon coupon(String code, Coupon.Kind kind, String amount, Integer limit, Instant expires) {
        return new Coupon(UUID.randomUUID(), code, kind, new BigDecimal(amount), null, null, limit, null, false, false, false, expires, true, null);
    }
    @Test void couponValidation() {
        assertThrows(IllegalArgumentException.class, () -> coupon("ab", Coupon.Kind.FIXED_CART, "1000", null, null));
        assertThrows(IllegalArgumentException.class, () -> coupon("BIENVENIDA", Coupon.Kind.PERCENT, "120", null, null));
        assertThrows(IllegalArgumentException.class, () -> coupon("BIENVENIDA", Coupon.Kind.FIXED_CART, "0", null, null));
        assertEquals("NAVIDAD", coupon("  NAVIDAD ", Coupon.Kind.PERCENT, "10", null, null).code());
    }
    @Test void couponRedeemable() {
        var now = Instant.now();
        assertTrue(coupon("NAVIDAD", Coupon.Kind.PERCENT, "10", 2, null).redeemable(1, now));
        assertFalse(coupon("NAVIDAD", Coupon.Kind.PERCENT, "10", 2, null).redeemable(2, now));
        assertFalse(coupon("NAVIDAD", Coupon.Kind.PERCENT, "10", null, now.minus(Duration.ofDays(1))).redeemable(0, now));
    }
}

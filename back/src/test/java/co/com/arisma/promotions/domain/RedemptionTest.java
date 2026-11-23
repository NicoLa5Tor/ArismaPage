package co.com.arisma.promotions.domain;
import static org.junit.jupiter.api.Assertions.*;
import co.com.arisma.promotions.domain.Redemption.CartLine;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class RedemptionTest {
    static final Instant NOW = Instant.parse("2026-11-12T12:00:00Z");
    static final UUID A = UUID.randomUUID(), B = UUID.randomUUID();
    static BigDecimal n(String v) { return new BigDecimal(v); }
    static Coupon coupon(Coupon.Kind kind, String amount, String min, String max, Integer limit, Integer perCustomer, boolean excludeSale, Instant expires, boolean active) {
        return new Coupon(UUID.randomUUID(), "PRUEBA", kind, n(amount), min == null ? null : n(min), max == null ? null : n(max), limit, perCustomer, false, false, excludeSale, expires, active, "");
    }
    static final List<CartLine> CART = List.of(new CartLine(A, 1, n("119000"), n("19"), false), new CartLine(B, 2, n("40000"), n("0"), true));

    @Test void percentAppliesToWhatEachLineCharges() {
        var result = Redemption.apply(coupon(Coupon.Kind.PERCENT, "10", null, null, null, null, false, null, true), CART, 0, 0, NOW);
        assertEquals(n("11900"), result.byLine().get(A));
        assertEquals(n("4000"), result.byLine().get(B));
        assertEquals(n("15900"), result.total());
    }
    @Test void fixedCartIsTaxExclusiveAndSharedByValue() {
        // 20.000 without tax: line A (net 100.000) takes 14.286 + 19 %, line B (net 40.000) takes 5.714
        var result = Redemption.apply(coupon(Coupon.Kind.FIXED_CART, "20000", null, null, null, null, false, null, true), CART, 0, 0, NOW);
        assertEquals(n("17000"), result.byLine().get(A));
        assertEquals(n("5714"), result.byLine().get(B));
    }
    @Test void fixedProductIsPerUnitAndNeverMoreThanTheLine() {
        var result = Redemption.apply(coupon(Coupon.Kind.FIXED_PRODUCT, "30000", null, null, null, null, false, null, true), CART, 0, 0, NOW);
        assertEquals(n("35700"), result.byLine().get(A));
        assertEquals(n("40000"), result.byLine().get(B), "two units of 30.000 would exceed the 40.000 line");
    }
    @Test void saleItemsCanBeExcluded() {
        var result = Redemption.apply(coupon(Coupon.Kind.PERCENT, "10", null, null, null, null, true, null, true), CART, 0, 0, NOW);
        assertFalse(result.byLine().containsKey(B));
        var onlySale = List.of(new CartLine(B, 1, n("40000"), n("0"), true));
        var error = assertThrows(IllegalArgumentException.class, () -> Redemption.apply(coupon(Coupon.Kind.PERCENT, "10", null, null, null, null, true, null, true), onlySale, 0, 0, NOW));
        assertTrue(error.getMessage().contains("oferta"));
    }
    @Test void everyRuleSaysWhyItRefuses() {
        assertTrue(refusal(coupon(Coupon.Kind.PERCENT, "10", null, null, null, null, false, null, false), 0, 0).contains("activo"));
        assertTrue(refusal(coupon(Coupon.Kind.PERCENT, "10", null, null, null, null, false, NOW, true), 0, 0).contains("venció"));
        assertTrue(refusal(coupon(Coupon.Kind.PERCENT, "10", null, null, 5, null, false, null, true), 5, 0).contains("agotó"));
        assertTrue(refusal(coupon(Coupon.Kind.PERCENT, "10", null, null, null, 1, false, null, true), 0, 1).contains("máximo"));
        assertTrue(refusal(coupon(Coupon.Kind.PERCENT, "10", "200000", null, null, null, false, null, true), 0, 0).contains("200.000"));
        assertTrue(refusal(coupon(Coupon.Kind.PERCENT, "10", null, "100000", null, null, false, null, true), 0, 0).contains("hasta"));
    }
    static String refusal(Coupon c, long uses, long mine) { return assertThrows(IllegalArgumentException.class, () -> Redemption.apply(c, CART, uses, mine, NOW)).getMessage(); }
}

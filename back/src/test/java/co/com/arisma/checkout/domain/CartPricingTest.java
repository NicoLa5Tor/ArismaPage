package co.com.arisma.checkout.domain;
import static org.junit.jupiter.api.Assertions.*;
import co.com.arisma.checkout.domain.CartPricing.Delivery;
import co.com.arisma.checkout.domain.CartPricing.Item;
import co.com.arisma.checkout.domain.CartPricing.Requested;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class CartPricingTest {
    static final UUID A = UUID.randomUUID(), B = UUID.randomUUID();
    static final BigDecimal MINIMUM = new BigDecimal("50000");
    static Item item(UUID id, String net, String percent, int max, boolean buyable) { return new Item(id, "slug", "Producto", "SKU", net == null ? null : new BigDecimal(net), false, new BigDecimal(percent), max, buyable, null, null, false); }
    static BigDecimal n(String v) { return new BigDecimal(v); }

    @Test void pricesWithTaxAndKeepsTheTaxExclusiveSplit() {
        var cart = CartPricing.price(List.of(new Requested(A, 2)), Map.of(A, item(A, "27000", "19", 99, true)), MINIMUM).withShipping(Delivery.LOCAL, n("11046"));
        var line = cart.lines().get(0);
        assertEquals(n("32130"), line.unitPrice());
        assertEquals(n("64260"), line.total());
        assertEquals(n("54000.00"), line.subtotalNet());
        assertEquals(n("10260.00"), line.tax());
        assertEquals(n("27000.00"), line.unitNet());
        assertEquals(0, cart.total().compareTo(n("75306")));
        assertEquals(0, cart.subtotalNet().subtract(cart.discountNet()).add(cart.tax()).add(cart.shipping()).compareTo(cart.total()), "what is stored adds up to what is charged");
        assertNull(cart.firstProblem());
    }
    @Test void aDiscountLowersTheTaxTheLineCarries() {
        var cart = CartPricing.price(List.of(new Requested(A, 1)), Map.of(A, item(A, "100000", "19", 99, true)), MINIMUM)
            .withDiscount("BIENVENIDA", Map.of(A, n("11900"))).withShipping(Delivery.PICKUP, BigDecimal.ZERO);
        var line = cart.lines().get(0);
        assertEquals(n("119000"), line.total());
        assertEquals(n("11900"), line.discount());
        assertEquals(n("100000.00"), line.subtotalNet());
        assertEquals(n("10000.00"), line.discountNet());
        assertEquals(n("17100.00"), line.tax());
        assertEquals(0, cart.total().compareTo(n("107100")));
        assertEquals(0, cart.subtotalNet().subtract(cart.discountNet()).add(cart.tax()).add(cart.shipping()).compareTo(cart.total()));
        assertEquals("BIENVENIDA", cart.coupon());
    }
    @Test void aDiscountNeverExceedsTheLineAndIgnoresLinesThatDoNotCount() {
        var catalog = Map.of(A, item(A, "60000", "0", 99, true), B, item(B, null, "0", 99, false));
        var cart = CartPricing.price(List.of(new Requested(A, 1), new Requested(B, 1)), catalog, MINIMUM).withDiscount("X", Map.of(A, n("999999"), B, n("5000")));
        assertEquals(n("60000"), cart.lines().get(0).discount());
        assertEquals(BigDecimal.ZERO, cart.lines().get(1).discount());
    }
    @Test void theMinimumOrderLooksAtWhatIsPaidAfterTheCoupon() {
        var cart = CartPricing.price(List.of(new Requested(A, 1)), Map.of(A, item(A, "55000", "0", 99, true)), MINIMUM);
        assertTrue(cart.blockers().isEmpty());
        assertEquals(1, cart.withDiscount("X", Map.of(A, n("10000"))).blockers().size());
        assertTrue(cart.withDiscount("X", Map.of(A, n("10000"))).firstProblem().contains("50.000"));
    }
    @Test void linesThatCannotBeBoughtAreReportedAndLeftOutOfTheTotal() {
        var catalog = Map.of(A, item(A, "100000", "0", 2, true), B, item(B, null, "0", 99, false));
        var cart = CartPricing.price(List.of(new Requested(A, 5), new Requested(B, 1), new Requested(UUID.randomUUID(), 1)), catalog, MINIMUM);
        assertEquals("Solo hay 2 unidades", cart.lines().get(0).problem());
        assertNotNull(cart.lines().get(1).problem());
        assertNotNull(cart.lines().get(2).problem());
        assertEquals(0, cart.goods().signum());
        assertNotNull(cart.firstProblem());
        assertNull(cart.shipping(), "no delivery chosen yet");
    }
    @Test void repeatedProductsAreMergedAndBadQuantitiesRefused() {
        var cart = CartPricing.price(List.of(new Requested(A, 1), new Requested(A, 2)), Map.of(A, item(A, "100000", "0", 99, true)), MINIMUM);
        assertEquals(3, cart.lines().get(0).quantity());
        assertThrows(IllegalArgumentException.class, () -> CartPricing.price(List.of(new Requested(A, 0)), Map.of(), MINIMUM));
        assertThrows(IllegalArgumentException.class, () -> CartPricing.price(List.of(), Map.of(), MINIMUM));
    }
}

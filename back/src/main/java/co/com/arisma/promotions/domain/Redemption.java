package co.com.arisma.promotions.domain;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.*;

/**
 * Applying a coupon to a cart. Amounts stored on coupons are tax-exclusive pesos (as WooCommerce kept them), so a fixed
 * discount grows by each line's tax rate; percentages apply to what the line charges. Spend limits compare what the
 * shopper sees: the products with tax included. Each line's discount is whole pesos and never more than the line.
 */
public final class Redemption {
    private Redemption() {}
    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

    /** A line of the cart as a coupon sees it. gross is what it charges, tax included. */
    public record CartLine(UUID id, int quantity, BigDecimal gross, BigDecimal taxPercent, boolean onSale) {}
    /** What the coupon takes from each line (tax included) and whether it also makes delivery free. */
    public record Result(UUID couponId, String code, Map<UUID, BigDecimal> byLine, boolean freeShipping) {
        public BigDecimal total() { return byLine.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add); }
    }

    /**
     * usesTotal and usesByCustomer count orders that hold the coupon and were not cancelled. Refused coupons explain
     * why in the shopper's words.
     */
    public static Result apply(Coupon coupon, List<CartLine> lines, long usesTotal, long usesByCustomer, Instant now) {
        if (!coupon.active()) throw new IllegalArgumentException("Este cupón no está activo");
        if (coupon.expiresAt() != null && !now.isBefore(coupon.expiresAt())) throw new IllegalArgumentException("Este cupón venció");
        if (coupon.usageLimit() != null && usesTotal >= coupon.usageLimit()) throw new IllegalArgumentException("Este cupón ya se agotó");
        if (coupon.usageLimitPerCustomer() != null && usesByCustomer >= coupon.usageLimitPerCustomer()) throw new IllegalArgumentException("Ya usaste este cupón el máximo de veces permitido");
        BigDecimal spend = lines.stream().map(CartLine::gross).reduce(BigDecimal.ZERO, BigDecimal::add);
        if (coupon.minimumAmount() != null && spend.compareTo(coupon.minimumAmount()) < 0) throw new IllegalArgumentException("Este cupón aplica en compras desde " + pesos(coupon.minimumAmount()));
        if (coupon.maximumAmount() != null && spend.compareTo(coupon.maximumAmount()) > 0) throw new IllegalArgumentException("Este cupón aplica en compras hasta " + pesos(coupon.maximumAmount()));
        var eligible = lines.stream().filter(l -> l.gross().signum() > 0 && !(coupon.excludeSaleItems() && l.onSale())).toList();
        if (eligible.isEmpty()) throw new IllegalArgumentException(coupon.excludeSaleItems() ? "Este cupón no aplica a productos en oferta" : "Este cupón no aplica a los productos de tu carrito");

        var byLine = new LinkedHashMap<UUID, BigDecimal>();
        switch (coupon.kind()) {
            case PERCENT -> { for (var l : eligible) byLine.put(l.id(), l.gross().multiply(coupon.amount()).divide(HUNDRED, 0, RoundingMode.HALF_UP)); }
            case FIXED_PRODUCT -> { for (var l : eligible) byLine.put(l.id(), coupon.amount().multiply(rate(l)).multiply(BigDecimal.valueOf(l.quantity())).setScale(0, RoundingMode.HALF_UP)); }
            case FIXED_CART -> {
                // the amount is shared out in proportion to each line's tax-exclusive value, then each share carries its line's tax
                BigDecimal net = eligible.stream().map(Redemption::net).reduce(BigDecimal.ZERO, BigDecimal::add);
                BigDecimal left = coupon.amount();
                for (int i = 0; i < eligible.size(); i++) {
                    var l = eligible.get(i);
                    BigDecimal share = i == eligible.size() - 1 ? left : coupon.amount().multiply(net(l)).divide(net, 2, RoundingMode.HALF_UP);
                    left = left.subtract(share);
                    byLine.put(l.id(), share.multiply(rate(l)).setScale(0, RoundingMode.HALF_UP));
                }
            }
        }
        for (var l : eligible) byLine.computeIfPresent(l.id(), (id, d) -> d.max(BigDecimal.ZERO).min(l.gross()));
        return new Result(coupon.id(), coupon.code(), Map.copyOf(byLine), coupon.freeShipping());
    }
    private static BigDecimal rate(CartLine l) { return BigDecimal.ONE.add((l.taxPercent() == null ? BigDecimal.ZERO : l.taxPercent()).divide(HUNDRED, 6, RoundingMode.HALF_UP)); }
    private static BigDecimal net(CartLine l) { return l.gross().divide(rate(l), 2, RoundingMode.HALF_UP); }
    private static String pesos(BigDecimal value) { return "$" + String.format(Locale.forLanguageTag("es-CO"), "%,d", value.setScale(0, RoundingMode.HALF_UP).longValue()); }
}

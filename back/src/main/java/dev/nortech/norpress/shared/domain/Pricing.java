package dev.nortech.norpress.shared.domain;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;

/** Prices are stored without tax (as WooCommerce did); customers see the tax-inclusive price rounded to whole pesos. */
public final class Pricing {
    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);
    private Pricing() {}
    public static BigDecimal withTax(BigDecimal base, BigDecimal percent) {
        if (base == null) return null;
        return base.multiply(BigDecimal.ONE.add(rate(percent))).setScale(0, RoundingMode.HALF_UP);
    }
    /** Base price that produces the given tax-inclusive price; kept at cent precision so withTax(withoutTax(x)) == x. */
    public static BigDecimal withoutTax(BigDecimal gross, BigDecimal percent) {
        if (gross == null) return null;
        if (gross.signum() < 0) throw new IllegalArgumentException("El precio no puede ser negativo");
        return gross.divide(BigDecimal.ONE.add(rate(percent)), 2, RoundingMode.HALF_UP);
    }
    public static boolean saleActive(BigDecimal sale, Instant starts, Instant ends, Instant now) {
        return sale != null && (starts == null || !now.isBefore(starts)) && (ends == null || now.isBefore(ends));
    }
    private static BigDecimal rate(BigDecimal percent) {
        BigDecimal p = percent == null ? BigDecimal.ZERO : percent;
        if (p.signum() < 0 || p.compareTo(HUNDRED) >= 0) throw new IllegalArgumentException("La tasa de impuesto debe estar entre 0 y 100");
        return p.divide(HUNDRED, 6, RoundingMode.HALF_UP);
    }
}

package co.com.arisma.promotions.domain;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.Locale;
import java.util.UUID;

/** Discount coupon. Codes are case-insensitive; fixed amounts are tax-exclusive pesos like product prices. */
public record Coupon(UUID id, String code, Kind kind, BigDecimal amount, BigDecimal minimumAmount, BigDecimal maximumAmount, Integer usageLimit, Integer usageLimitPerCustomer,
                     boolean individualUse, boolean freeShipping, boolean excludeSaleItems, Instant expiresAt, boolean active, String description) {
    public enum Kind { FIXED_CART, PERCENT, FIXED_PRODUCT; public String db() { return name().toLowerCase(Locale.ROOT); } }
    public Coupon {
        if (id == null) throw new IllegalArgumentException("Identificador requerido");
        code = code == null ? "" : code.trim();
        if (!code.matches("[\\p{L}0-9_-]{3,40}")) throw new IllegalArgumentException("El código debe tener entre 3 y 40 letras, números, guiones o guiones bajos");
        if (kind == null) throw new IllegalArgumentException("Indica el tipo de descuento");
        if (amount == null || amount.signum() <= 0) throw new IllegalArgumentException("El valor del descuento debe ser mayor que cero");
        if (kind == Kind.PERCENT && amount.compareTo(BigDecimal.valueOf(100)) > 0) throw new IllegalArgumentException("El porcentaje no puede superar 100");
        if (minimumAmount != null && minimumAmount.signum() < 0 || maximumAmount != null && maximumAmount.signum() < 0) throw new IllegalArgumentException("Los montos no pueden ser negativos");
        if (minimumAmount != null && maximumAmount != null && minimumAmount.compareTo(maximumAmount) > 0) throw new IllegalArgumentException("El mínimo no puede superar el máximo");
        if (usageLimit != null && usageLimit < 1 || usageLimitPerCustomer != null && usageLimitPerCustomer < 1) throw new IllegalArgumentException("Los límites de uso deben ser al menos 1 o quedar vacíos");
        description = description == null ? "" : description.trim();
    }
    /** Whether the coupon can still be redeemed, given how many times it has been used. */
    public boolean redeemable(long uses, Instant now) { return active && (expiresAt == null || now.isBefore(expiresAt)) && (usageLimit == null || uses < usageLimit); }
}

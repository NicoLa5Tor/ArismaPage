package co.com.arisma.catalog.domain;
import java.math.BigDecimal;
import java.util.UUID;

/** Configurable tax rate (IVA 19 %, 5 %, exento…). Prices are stored without tax and use the product's rate. */
public record TaxRate(UUID id, String code, String name, BigDecimal percent, boolean active) {
    public TaxRate {
        if (id == null) throw new IllegalArgumentException("Identificador requerido");
        code = code == null ? "" : code.trim();
        name = name == null ? "" : name.trim();
        if (!code.matches("[a-z0-9-]{2,30}")) throw new IllegalArgumentException("El código usa de 2 a 30 minúsculas, números o guiones");
        if (name.isEmpty()) throw new IllegalArgumentException("El nombre es obligatorio");
        if (percent == null || percent.signum() < 0 || percent.compareTo(BigDecimal.valueOf(100)) >= 0 || percent.stripTrailingZeros().scale() > 2)
            throw new IllegalArgumentException("La tasa debe estar entre 0 y 99,99 con máximo dos decimales");
    }
    /** Changing the percent of a rate in use would silently change every customer price. */
    public void requireCompatibleWith(BigDecimal currentPercent, long productsUsingIt) {
        if (productsUsingIt > 0 && currentPercent.compareTo(percent) != 0)
            throw new IllegalArgumentException("Esta tasa está en uso; crea una nueva tasa y reasigna los productos");
    }
}

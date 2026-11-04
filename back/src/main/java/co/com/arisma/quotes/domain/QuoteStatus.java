package co.com.arisma.quotes.domain;
import java.util.Locale;

/** Quote request lifecycle. A converted quote became an order and is final; the rest are set by hand. */
public enum QuoteStatus {
    PENDING, ACCEPTED, REJECTED, EXPIRED, CONVERTED;
    public String db() { return name().toLowerCase(Locale.ROOT); }
    public static QuoteStatus parse(String value) {
        if (value == null || value.isBlank()) return null;
        try { return valueOf(value.trim().toUpperCase(Locale.ROOT)); } catch (IllegalArgumentException e) { throw new IllegalArgumentException("Estado de cotización inválido"); }
    }
    public void requireManualMoveTo(QuoteStatus next) {
        if (this == CONVERTED) throw new IllegalArgumentException("La cotización ya se convirtió en pedido");
        if (next == null || next == CONVERTED) throw new IllegalArgumentException("Una cotización solo se convierte al crear su pedido");
    }
}

package co.com.arisma.inventory.domain;
import java.util.Locale;

/** Why stock changed: a manual edit, a sale, goods returned by a cancellation, or the historical import. */
public enum MovementKind {
    MANUAL, SALE, CANCEL, IMPORT;
    public String db() { return name().toLowerCase(Locale.ROOT); }
    /** Parses an optional filter value; blank means any kind. */
    public static MovementKind parse(String value) {
        if (value == null || value.isBlank()) return null;
        try { return valueOf(value.trim().toUpperCase(Locale.ROOT)); }
        catch (IllegalArgumentException e) { throw new IllegalArgumentException("Tipo de movimiento inválido"); }
    }
}

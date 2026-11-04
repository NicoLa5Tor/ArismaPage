package co.com.arisma.fulfillment.domain;
import java.util.Locale;

/** How the order reaches the customer: a carrier with a tracking number, our own courier, or pickup at the store. */
public enum DeliveryMethod {
    CARRIER, COURIER, PICKUP;
    public String db() { return name().toLowerCase(Locale.ROOT); }
    public static DeliveryMethod parse(String value) {
        if (value == null || value.isBlank()) return null;
        try { return valueOf(value.trim().toUpperCase(Locale.ROOT)); } catch (IllegalArgumentException e) { throw new IllegalArgumentException("Método de entrega inválido"); }
    }
}

package dev.nortech.norpress.settings.domain;
import java.util.Map;

/**
 * Rules of the store's orders. unpaidHours: how long an order may wait for payment before it is cancelled and its
 * units go back to the shelf. shopperCancels: the shopper may cancel their order on their own while it has not left
 * (a paid one is refunded right away); when off, only the store cancels, from the panel. Once an order left, the shopper
 * never cancels it from the store.
 */
public record CheckoutRules(int unpaidHours, boolean shopperCancels) {
    public static final String KEY = "checkout";
    public static final CheckoutRules DEFAULT = new CheckoutRules(48, true);
    public CheckoutRules { if (unpaidHours < 1 || unpaidHours > 720) throw new IllegalArgumentException("El plazo para pagar va de 1 a 720 horas"); }
    public static CheckoutRules fromMap(Map<String, Object> m) {
        if (m == null) return DEFAULT;
        int hours = m.get("unpaidHours") instanceof Number n ? n.intValue() : DEFAULT.unpaidHours();
        boolean cancels = m.get("shopperCancels") instanceof Boolean b ? b : DEFAULT.shopperCancels();
        return new CheckoutRules(hours, cancels);
    }
    public Map<String, Object> toMap() { return Map.of("unpaidHours", unpaidHours, "shopperCancels", shopperCancels); }
}

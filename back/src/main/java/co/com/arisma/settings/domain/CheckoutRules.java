package co.com.arisma.settings.domain;
import java.util.Map;

/** How long an order may wait for payment before it is cancelled and its units go back to the shelf. */
public record CheckoutRules(int unpaidHours) {
    public static final String KEY = "checkout";
    public static final CheckoutRules DEFAULT = new CheckoutRules(48);
    public CheckoutRules { if (unpaidHours < 1 || unpaidHours > 720) throw new IllegalArgumentException("El plazo para pagar va de 1 a 720 horas"); }
    public static CheckoutRules fromMap(Map<String, Object> m) { return m != null && m.get("unpaidHours") instanceof Number n ? new CheckoutRules(n.intValue()) : DEFAULT; }
    public Map<String, Object> toMap() { return Map.of("unpaidHours", unpaidHours); }
}

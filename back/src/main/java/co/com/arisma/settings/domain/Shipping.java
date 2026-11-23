package co.com.arisma.settings.domain;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Delivery rules, in pesos with tax included: one rate for the store's local area (its city, see StoreProfile) and one
 * for the rest of the country, free local delivery from an order value (null: never free), pickup at the shop, and the
 * smallest order the store takes. Stores saved before the local area existed used the keys bogotaRate and freeFromBogota.
 */
public record Shipping(BigDecimal localRate, BigDecimal nationalRate, BigDecimal freeFromLocal, boolean pickup, BigDecimal minimumOrder) {
    public static final String KEY = "shipping";
    /** A new store: one flat rate everywhere, never free, pickup offered and no minimum, until the administrator sets its own. */
    public static final Shipping DEFAULT = new Shipping(new BigDecimal("12000"), new BigDecimal("12000"), null, true, BigDecimal.ZERO);
    public enum Method { LOCAL, NATIONAL, PICKUP }

    public Shipping {
        localRate = amount(localRate, "La tarifa local", false);
        nationalRate = amount(nationalRate, "La tarifa nacional", false);
        freeFromLocal = amount(freeFromLocal, "El valor para envío gratis", true);
        minimumOrder = amount(minimumOrder, "La compra mínima", true);
        if (minimumOrder == null) minimumOrder = BigDecimal.ZERO;
    }
    /** What delivery costs for an order worth `goods` (tax included, after discounts). */
    public BigDecimal cost(Method method, BigDecimal goods) {
        return switch (method) {
            case PICKUP -> { if (!pickup) throw new IllegalArgumentException("La recogida en tienda no está disponible"); yield BigDecimal.ZERO; }
            case LOCAL -> freeFromLocal != null && goods.compareTo(freeFromLocal) >= 0 ? BigDecimal.ZERO : localRate;
            case NATIONAL -> nationalRate;
        };
    }
    public static Shipping fromMap(Map<String, Object> m) {
        if (m == null || m.isEmpty()) return DEFAULT;
        return new Shipping(number(m.getOrDefault("localRate", m.get("bogotaRate"))), number(m.get("nationalRate")), number(m.containsKey("freeFromLocal") ? m.get("freeFromLocal") : m.get("freeFromBogota")), Conversations.flag(m, "pickup", true), number(m.get("minimumOrder")));
    }
    public Map<String, Object> toMap() {
        var out = new LinkedHashMap<String, Object>();
        out.put("localRate", localRate); out.put("nationalRate", nationalRate); out.put("freeFromLocal", freeFromLocal); out.put("pickup", pickup); out.put("minimumOrder", minimumOrder);
        return out;
    }
    static BigDecimal number(Object value) {
        if (value == null || value instanceof String s && s.isBlank()) return null;
        try { return new BigDecimal(value.toString().trim()); } catch (NumberFormatException e) { throw new IllegalArgumentException("Escribe los valores en pesos, solo con números"); }
    }
    private static BigDecimal amount(BigDecimal value, String what, boolean optional) {
        if (value == null) { if (optional) return null; throw new IllegalArgumentException(what + " es obligatoria"); }
        if (value.signum() < 0 || value.compareTo(new BigDecimal("100000000")) > 0) throw new IllegalArgumentException(what + " no es un valor válido");
        return value.setScale(0, RoundingMode.HALF_UP);
    }
}

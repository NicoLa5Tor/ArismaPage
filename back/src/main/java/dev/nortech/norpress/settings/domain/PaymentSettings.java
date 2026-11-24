package dev.nortech.norpress.settings.domain;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Which single payment method the store offers (none while it is not set up) and whether it charges for real
 * (production) or only simulates (tests). Shoppers never choose: they pay with the active method.
 */
public record PaymentSettings(Gateway.Code active, boolean test) {
    public static final String KEY = "payments";
    public static final PaymentSettings DEFAULT = new PaymentSettings(null, true);

    /** The active method must be complete in the mode being turned on, or shoppers would reach a broken payment. */
    public void requireReady(Gateway credentials) {
        if (active == null) return;
        if (credentials == null || credentials.code() != active || !credentials.complete())
            throw new IllegalArgumentException("Completa los datos de " + active.label + (active.hasEnvironments() ? " para " + (test ? "pruebas" : "producción") : "") + " antes de activarlo");
    }
    public static PaymentSettings fromMap(Map<String, Object> m) {
        if (m == null || m.isEmpty()) return DEFAULT;
        Gateway.Code active = null;
        if (m.get("active") instanceof String code && !code.isBlank()) { try { active = Gateway.Code.parse(code); } catch (IllegalArgumentException ignored) { /* unknown: none */ } }
        return new PaymentSettings(active, !"live".equals(m.get("mode")));
    }
    public Map<String, Object> toMap() {
        var out = new LinkedHashMap<String, Object>();
        out.put("active", active == null ? "" : active.db());
        out.put("mode", test ? "test" : "live");
        return out;
    }
}

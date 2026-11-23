package co.com.arisma.settings.domain;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * The credentials of one payment method in one environment (tests or production). Public fields may reach the
 * browser (public keys, merchant ids, instructions); secret fields never leave the server once saved.
 */
public record Gateway(Code code, boolean test, Map<String, String> config, Map<String, String> secrets) {
    public enum Code {
        WOMPI("Wompi", List.of("publicKey"), List.of("privateKey", "integritySecret", "eventsSecret"), List.of("privateKey", "integritySecret", "eventsSecret")),
        PAYU("PayU", List.of("merchantId", "accountId"), List.of("apiKey"), List.of("apiKey")),
        MANUAL("Transferencia o acuerdo por WhatsApp", List.of("instructions"), List.of(), List.of());
        public final String label;
        public final List<String> publicFields, secretFields, requiredSecrets;
        Code(String label, List<String> publicFields, List<String> secretFields, List<String> requiredSecrets) { this.label = label; this.publicFields = publicFields; this.secretFields = secretFields; this.requiredSecrets = requiredSecrets; }
        public String db() { return name().toLowerCase(Locale.ROOT); }
        public static Code parse(String value) {
            try { return valueOf(value.trim().toUpperCase(Locale.ROOT)); } catch (RuntimeException e) { throw new IllegalArgumentException("Medio de pago desconocido"); }
        }
        /** Transfer instructions are the same in tests and in production. */
        public boolean hasEnvironments() { return this != MANUAL; }
    }
    public static final int MAX_VALUE = 2000;

    public Gateway {
        if (code == null) throw new IllegalArgumentException("Medio de pago requerido");
        if (!code.hasEnvironments()) test = false;
        config = only(config, code.publicFields);
        secrets = only(secrets, code.secretFields);
    }
    /** Everything it needs to take payments is filled in. */
    public boolean complete() { return code.publicFields.stream().allMatch(config::containsKey) && code.requiredSecrets.stream().allMatch(secrets::containsKey); }
    public String environment() { return test ? "pruebas" : "producción"; }

    /**
     * Keys of one environment saved in the other are the classic mistake: Wompi says which one each key belongs to
     * in its prefix, so a mismatch is refused here instead of failing at the shopper's payment.
     */
    public void requireMatchingEnvironment() {
        if (code != Code.WOMPI) return;
        var expected = Map.of("publicKey", test ? "pub_test_" : "pub_prod_", "privateKey", test ? "prv_test_" : "prv_prod_",
            "integritySecret", test ? "test_integrity_" : "prod_integrity_", "eventsSecret", test ? "test_events_" : "prod_events_");
        var values = new LinkedHashMap<String, String>(config); values.putAll(secrets);
        expected.forEach((field, prefix) -> {
            String value = values.get(field);
            if (value != null && !value.startsWith(prefix)) throw new IllegalArgumentException("La llave de Wompi «" + field + "» no es de " + environment() + ": debe empezar por " + prefix);
        });
    }

    /** New secrets replace old ones field by field; a blank value keeps what was stored. */
    public Gateway merge(Map<String, String> config, Map<String, String> newSecrets) {
        var kept = new LinkedHashMap<>(secrets);
        kept.putAll(only(newSecrets, code.secretFields));
        return new Gateway(code, test, config, kept);
    }
    private static Map<String, String> only(Map<String, String> raw, List<String> allowed) {
        var out = new LinkedHashMap<String, String>();
        if (raw != null) for (String field : allowed) {
            String value = raw.get(field);
            if (value == null || value.isBlank()) continue;
            if (value.length() > MAX_VALUE) throw new IllegalArgumentException("Un dato del medio de pago es demasiado largo");
            out.put(field, value.trim());
        }
        return Collections.unmodifiableMap(out);
    }
    /** Dots and the last four characters: enough to recognise a stored key without revealing it. */
    public static String hint(String secret) { return secret == null || secret.isEmpty() ? null : "••••" + (secret.length() > 8 ? secret.substring(secret.length() - 4) : ""); }
}

package co.com.arisma.fulfillment.domain;
import java.text.Normalizer;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

/**
 * Carriers the store ships with, matched from what the team types. trackingKey is the carrier's code in the tracking
 * provider (17TRACK); null means the provider detects it from the number. trackingPage is the carrier's own page where
 * the shopper types the number: none of them takes it in the address, so the store shows the number next to the link.
 */
public enum Carrier {
    INTER("Inter Rapidísimo", 100491, "https://www.interrapidisimo.com/", "inter", "interrapidisimo", "inter rapidisimo"),
    COORDINADORA("Coordinadora", 100493, "https://coordinadora.com/rastreo/rastreo-de-guia/", "coordinadora"),
    SERVIENTREGA("Servientrega", null, "https://www.servientrega.com/wps/portal/rastreo-envio", "servientrega"),
    ENVIA("Envía", 100993, "https://envia.co/", "envia", "envia colvanes", "colvanes"),
    TCC("TCC", 101181, "https://tcc.com.co/", "tcc"),
    DEPRISA("Deprisa", 100287, "https://www.deprisa.com/", "deprisa"),
    POSTAL("4-72", 3131, "https://www.4-72.com.co/", "472", "4 72", "4-72", "servicios postales nacionales");

    public final String label;
    public final Integer trackingKey;
    public final String trackingPage;
    private final List<String> names;
    Carrier(String label, Integer trackingKey, String trackingPage, String... names) { this.label = label; this.trackingKey = trackingKey; this.trackingPage = trackingPage; this.names = List.of(names); }

    /** "Interrapidísimo", "INTER RAPIDISIMO" and "inter" are the same carrier; an unknown name is not an error. */
    public static Optional<Carrier> match(String typed) {
        if (typed == null || typed.isBlank()) return Optional.empty();
        String key = simple(typed);
        for (var c : values()) for (var n : c.names) if (simple(n).equals(key)) return Optional.of(c);
        return Optional.empty();
    }
    private static String simple(String text) {
        return Normalizer.normalize(text, Normalizer.Form.NFD).replaceAll("\\p{M}", "").toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", " ").trim();
    }
}

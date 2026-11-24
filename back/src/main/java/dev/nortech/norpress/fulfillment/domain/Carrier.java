package dev.nortech.norpress.fulfillment.domain;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * A carrier the store ships with, as the store keeps it (Tienda → Envíos). The team picks it when shipping and the
 * shopper gets its link: `linkTemplate` puts the number in the address where the carrier's page takes it ({guia});
 * otherwise `pageUrl` is the plain tracking page and the number is shown next to it. `trackingKey` is the carrier's
 * code in the tracking provider (17TRACK); null lets the provider detect it.
 */
public record Carrier(String code, String name, List<String> aliases, Integer trackingKey, String linkTemplate, String pageUrl, String numberHint, boolean active, int position) {
    public static final String NUMBER_SLOT = "{guia}";
    private static final Pattern CODE = Pattern.compile("[a-z0-9-]{2,30}");

    public Carrier {
        code = code == null ? "" : code.trim().toLowerCase(Locale.ROOT);
        if (!CODE.matcher(code).matches()) throw new IllegalArgumentException("El código de la transportadora va en minúsculas, sin espacios (2 a 30 letras o números)");
        name = name == null ? "" : name.trim();
        if (name.length() < 2 || name.length() > 60 || name.indexOf('<') >= 0) throw new IllegalArgumentException("Escribe el nombre de la transportadora");
        aliases = aliases == null ? List.of() : aliases.stream().map(Carrier::simple).filter(a -> !a.isEmpty()).distinct().toList();
        linkTemplate = blankToNull(linkTemplate);
        pageUrl = blankToNull(pageUrl);
        if (linkTemplate != null) {
            requireWebAddress(linkTemplate.replace(NUMBER_SLOT, "0"), "El enlace con la guía no es una dirección web válida (https://…)");
            if (!linkTemplate.contains(NUMBER_SLOT)) throw new IllegalArgumentException("El enlace con la guía debe llevar " + NUMBER_SLOT + " donde va el número");
            if (linkTemplate.indexOf(NUMBER_SLOT) != linkTemplate.lastIndexOf(NUMBER_SLOT)) throw new IllegalArgumentException("Pon " + NUMBER_SLOT + " una sola vez en el enlace");
        }
        if (pageUrl != null) requireWebAddress(pageUrl, "La página de rastreo no es una dirección web válida (https://…)");
        numberHint = numberHint == null ? "" : numberHint.trim();
        if (numberHint.length() > 80) throw new IllegalArgumentException("La ayuda del número de guía admite 80 caracteres");
    }

    /** Where the shopper follows this guide: straight to it when the page takes the number, else the tracking page. */
    public String linkFor(String number) {
        if (linkTemplate != null && number != null && !number.isBlank()) return linkTemplate.replace(NUMBER_SLOT, URLEncoder.encode(number.trim(), StandardCharsets.UTF_8));
        return pageUrl;
    }
    /** True when the link already opens the guide (no need to paste the number). */
    public boolean opensTheGuide() { return linkTemplate != null; }

    /** "Interrapidísimo", "INTER RAPIDISIMO" and "inter" are the same carrier. */
    public boolean matches(String typed) {
        String key = simple(typed);
        return !key.isEmpty() && (key.equals(simple(name)) || key.equals(code) || aliases.contains(key));
    }

    /** A guide number as carriers print it: letters, digits and dashes, without spaces, in capitals. */
    public static String normalizeNumber(String raw) {
        String n = raw == null ? "" : raw.replaceAll("\\s+", "").toUpperCase(Locale.ROOT);
        if (n.length() < 4 || n.length() > 40 || !n.matches("[A-Z0-9-]+")) throw new IllegalArgumentException("El número de guía lleva de 4 a 40 letras, números o guiones, sin espacios");
        return n;
    }

    static String simple(String text) {
        if (text == null) return "";
        return Normalizer.normalize(text, Normalizer.Form.NFD).replaceAll("\\p{M}", "").toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", " ").trim();
    }
    private static String blankToNull(String s) { return s == null || s.isBlank() ? null : s.trim(); }
    private static void requireWebAddress(String value, String message) {
        try {
            var uri = URI.create(value);
            if (!"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null || value.length() > 300) throw new IllegalArgumentException(message);
        } catch (IllegalArgumentException e) { throw new IllegalArgumentException(message); }
    }
}

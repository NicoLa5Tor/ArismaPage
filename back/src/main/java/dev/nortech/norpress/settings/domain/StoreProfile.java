package dev.nortech.norpress.settings.domain;
import java.text.Normalizer;
import java.util.*;
import java.util.regex.Pattern;

/**
 * Who the store is: the name shoppers read in emails, payments and answers, its legal data, where it is (the shop for
 * pickup and the local area with its own delivery rate), how to reach it and its legal pages. Every store fills its own;
 * nothing about one store is written in the code.
 *
 * localCity and localState (an ISO 3166-2 code such as CO-DC) say which buyers pay the local rate: a buyer in that
 * department, or one whose city reads like localCity. shortName is how people call the store in a sentence ("Pregúntale
 * a Juguetería"); empty, it is the name. color is the brand colour of the emails, as #rrggbb.
 */
public record StoreProfile(String name, String shortName, String legalName, String taxId, String address, String addressDetail, String localCity, String localState,
                           String whatsapp, String phone, String email, List<String> hours, String site, String termsUrl, String privacyUrl, String color) {
    public static final String KEY = "store";
    private static final Pattern STATE = Pattern.compile("CO-[A-Z]{2,3}");
    private static final Pattern COLOR = Pattern.compile("#[0-9a-f]{6}");
    private static final Pattern EMAIL = Pattern.compile("[^@\\s<>]+@[^@\\s<>]+\\.[^@\\s<>]{2,}");
    private static final String DEFAULT_COLOR = "#1d1a23";
    /** Declared after the patterns, which the constructor needs. */
    public static final StoreProfile DEFAULT = new StoreProfile("Mi tienda", "", "", "", "", "", "", "", "", "", "", List.of(), "", "", "", DEFAULT_COLOR);

    public StoreProfile {
        name = text(name, 60, "El nombre de la tienda");
        if (name.isEmpty()) throw new IllegalArgumentException("Escribe el nombre de la tienda");
        shortName = text(shortName, 30, "El nombre corto");
        if (shortName.isEmpty()) shortName = name;
        legalName = text(legalName, 100, "La razón social"); taxId = text(taxId, 30, "El NIT");
        address = text(address, 120, "La dirección"); addressDetail = text(addressDetail, 120, "El detalle de la dirección");
        localCity = text(localCity, 60, "La ciudad");
        localState = localState == null ? "" : localState.trim().toUpperCase(Locale.ROOT);
        if (!localState.isEmpty() && !STATE.matcher(localState).matches()) throw new IllegalArgumentException("Elige el departamento de la tienda");
        whatsapp = whatsapp == null ? "" : whatsapp.replaceAll("[^0-9]", "");
        if (!whatsapp.isEmpty() && (whatsapp.length() < 10 || whatsapp.length() > 15)) throw new IllegalArgumentException("Escribe el WhatsApp con el indicativo del país, por ejemplo 573001234567");
        phone = text(phone, 30, "El teléfono");
        email = text(email, 254, "El correo").toLowerCase(Locale.ROOT);
        if (!email.isEmpty() && !EMAIL.matcher(email).matches()) throw new IllegalArgumentException("El correo de la tienda no es válido");
        hours = hours == null ? List.of() : hours.stream().filter(Objects::nonNull).map(String::trim).filter(h -> !h.isEmpty()).limit(7).toList();
        for (var h : hours) if (h.length() > 80) throw new IllegalArgumentException("Cada línea del horario admite 80 caracteres");
        site = url(site, "La dirección del sitio"); termsUrl = url(termsUrl, "El enlace de términos"); privacyUrl = url(privacyUrl, "El enlace de la política de datos");
        color = color == null || color.isBlank() ? DEFAULT_COLOR : color.trim().toLowerCase(Locale.ROOT);
        if (!COLOR.matcher(color).matches()) throw new IllegalArgumentException("El color va en formato #rrggbb");
    }

    /** Pickup address as one line, empty when the store has no address yet. */
    public String pickupLine() {
        var parts = new ArrayList<String>();
        if (!address.isEmpty()) parts.add(addressDetail.isEmpty() ? address : address + ", " + addressDetail);
        if (!localCity.isEmpty() && !parts.isEmpty()) parts.add(localCity);
        return String.join(", ", parts);
    }
    /** Name, address and WhatsApp, for the foot of every email. */
    public String signature() {
        var parts = new ArrayList<String>(List.of(name));
        if (!address.isEmpty()) parts.add(localCity.isEmpty() ? address : address + ", " + localCity);
        if (!whatsapp.isEmpty()) parts.add("WhatsApp " + whatsappLabel());
        return String.join(" · ", parts);
    }
    /** Who sells: legal name, NIT and contact email, for the foot of emails and pages. Empty parts are left out. */
    public String legalLine() {
        var parts = new ArrayList<String>();
        if (!legalName.isEmpty()) parts.add(legalName);
        if (!taxId.isEmpty()) parts.add("NIT " + taxId);
        if (!email.isEmpty()) parts.add(email);
        return String.join(" · ", parts);
    }
    /** A Colombian mobile reads as 310 866 9112; any other number is shown as stored. */
    public String whatsappLabel() {
        String local = whatsapp.startsWith("57") && whatsapp.length() == 12 ? whatsapp.substring(2) : null;
        return local == null ? whatsapp : local.substring(0, 3) + " " + local.substring(3, 6) + " " + local.substring(6);
    }
    /** Whether a delivery to this city and department pays the local rate. No local area set: nobody does. */
    public boolean isLocal(String city, String state) {
        if (!localState.isEmpty() && localState.equalsIgnoreCase(state == null ? "" : state.trim())) return true;
        String mine = simple(localCity);
        return !mine.isEmpty() && simple(city).contains(mine);
    }
    static String simple(String text) {
        if (text == null) return "";
        return Normalizer.normalize(text, Normalizer.Form.NFD).replaceAll("\\p{M}", "").toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", " ").trim();
    }

    public static StoreProfile fromMap(Map<String, Object> m) {
        if (m == null || m.isEmpty()) return DEFAULT;
        List<String> hours = m.get("hours") instanceof List<?> l ? l.stream().map(o -> Objects.toString(o, "")).toList() : List.of();
        return new StoreProfile(text(m, "name"), text(m, "shortName"), text(m, "legalName"), text(m, "taxId"), text(m, "address"), text(m, "addressDetail"), text(m, "localCity"), text(m, "localState"),
            text(m, "whatsapp"), text(m, "phone"), text(m, "email"), hours, text(m, "site"), text(m, "termsUrl"), text(m, "privacyUrl"), text(m, "color"));
    }
    public Map<String, Object> toMap() {
        var out = new LinkedHashMap<String, Object>();
        out.put("name", name); out.put("shortName", shortName); out.put("legalName", legalName); out.put("taxId", taxId); out.put("address", address); out.put("addressDetail", addressDetail);
        out.put("localCity", localCity); out.put("localState", localState); out.put("whatsapp", whatsapp); out.put("phone", phone); out.put("email", email);
        out.put("hours", hours); out.put("site", site); out.put("termsUrl", termsUrl); out.put("privacyUrl", privacyUrl); out.put("color", color);
        return out;
    }
    private static String text(Map<String, Object> m, String key) { return m.get(key) == null ? "" : String.valueOf(m.get(key)); }
    private static String text(String value, int max, String what) {
        String v = value == null ? "" : value.trim().replaceAll("\\s+", " ");
        if (v.length() > max) throw new IllegalArgumentException(what + " admite " + max + " caracteres");
        if (v.indexOf('<') >= 0 || v.indexOf('>') >= 0) throw new IllegalArgumentException(what + " solo admite texto");
        return v;
    }
    private static String url(String value, String what) {
        String v = text(value, 300, what);
        if (!v.isEmpty() && !v.startsWith("https://") && !v.startsWith("http://")) throw new IllegalArgumentException(what + " debe empezar por https://");
        return v;
    }
}

package co.com.arisma.customers.domain;
import java.util.Locale;
import java.util.Set;

/** The buyer's own data, kept on their customer record and filled in at checkout: name, phone and identity document. */
public record Profile(String firstName, String lastName, String phone, String documentType, String documentNumber, String company) {
    public static final Set<String> DOCUMENTS = Set.of("CC", "CE", "NIT", "PA", "TI");

    /** Checks it before an order is placed or the profile is saved; a stored profile may still be incomplete. */
    public Profile validated() {
        String first = clean(firstName, 60), last = clean(lastName, 60);
        if (first.length() < 2) throw new IllegalArgumentException("Escribe tu nombre");
        if (last.length() < 2) throw new IllegalArgumentException("Escribe tu apellido");
        String p = phone == null ? "" : phone.replaceAll("[^0-9+]", "");
        if (p.replace("+", "").length() < 7 || p.length() > 16) throw new IllegalArgumentException("Escribe un celular de contacto válido");
        String type = documentType == null ? "" : documentType.trim().toUpperCase(Locale.ROOT);
        if (!DOCUMENTS.contains(type)) throw new IllegalArgumentException("Elige el tipo de documento");
        String number = documentNumber == null ? "" : documentNumber.replaceAll("[^0-9A-Za-z-]", "");
        if (number.length() < 5 || number.length() > 20) throw new IllegalArgumentException("Escribe el número de documento");
        return new Profile(first, last, p, type, number, clean(company, 100));
    }
    private static String clean(String raw, int max) {
        String value = raw == null ? "" : raw.trim().replaceAll("\\s+", " ");
        if (value.length() > max) throw new IllegalArgumentException("Un dato es demasiado largo (máximo " + max + " caracteres)");
        if (value.indexOf('<') >= 0 || value.indexOf('>') >= 0) throw new IllegalArgumentException("Escribe los datos sin símbolos < o >");
        return value;
    }
}

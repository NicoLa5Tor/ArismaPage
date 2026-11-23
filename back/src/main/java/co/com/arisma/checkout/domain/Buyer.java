package co.com.arisma.checkout.domain;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Who buys and where the order goes. Pickup needs no address. The maps use the same keys as the imported orders
 * (first_name, address_1, id_type…), so the panel reads new and old orders alike.
 */
public record Buyer(String firstName, String lastName, String email, String phone, String documentType, String documentNumber, String company,
                    boolean pickup, String address, String addressDetail, String city, String state, String note) {
    public static final Set<String> DOCUMENTS = Set.of("CC", "CE", "NIT", "PA", "TI");
    private static final Pattern EMAIL = Pattern.compile("[^@\\s<>]+@[^@\\s<>]+\\.[^@\\s<>]{2,}");
    private static final Pattern STATE = Pattern.compile("CO-[A-Z]{2,3}");

    public Buyer {
        firstName = text(firstName, 2, 60, "Escribe tu nombre");
        lastName = text(lastName, 2, 60, "Escribe tu apellido");
        email = email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
        if (email.length() > 254 || !EMAIL.matcher(email).matches()) throw new IllegalArgumentException("Escribe un correo válido");
        phone = phone == null ? "" : phone.replaceAll("[^0-9+]", "");
        if (phone.replace("+", "").length() < 7 || phone.length() > 16) throw new IllegalArgumentException("Escribe un teléfono de contacto válido");
        documentType = documentType == null ? "" : documentType.trim().toUpperCase(Locale.ROOT);
        if (!DOCUMENTS.contains(documentType)) throw new IllegalArgumentException("Elige el tipo de documento");
        documentNumber = documentNumber == null ? "" : documentNumber.replaceAll("[^0-9A-Za-z-]", "");
        if (documentNumber.length() < 5 || documentNumber.length() > 20) throw new IllegalArgumentException("Escribe el número de documento");
        company = optional(company, 100);
        note = optional(note, 500);
        if (pickup) { address = ""; addressDetail = ""; city = optional(city, 60); state = state == null ? "" : state.trim(); }
        else {
            address = text(address, 5, 120, "Escribe la dirección de entrega");
            addressDetail = optional(addressDetail, 120);
            city = text(city, 2, 60, "Escribe la ciudad");
            state = state == null ? "" : state.trim().toUpperCase(Locale.ROOT);
            if (!STATE.matcher(state).matches()) throw new IllegalArgumentException("Elige el departamento");
        }
    }
    public String fullName() { return firstName + " " + lastName; }

    public Map<String, String> billing() {
        var out = contact();
        out.put("email", email); out.put("phone", phone); out.put("id_type", documentType); out.put("id", documentNumber);
        return out;
    }
    public Map<String, String> shipping() { return pickup ? new LinkedHashMap<>() : contact(); }
    /**
     * Where the order goes when it comes from a saved address: who receives it (it may be someone else), their phone,
     * the neighbourhood, notes for whoever delivers it and whether it is a home or a workplace.
     */
    public record Destination(String firstName, String lastName, String phone, String neighborhood, String instructions, String label) {}
    public Map<String, String> shipping(Destination to) {
        var out = shipping();
        if (pickup || to == null) return out;
        out.put("first_name", to.firstName()); out.put("last_name", to.lastName()); out.put("phone", to.phone());
        out.put("neighborhood", to.neighborhood()); out.put("instructions", to.instructions()); out.put("label", to.label());
        return out;
    }
    private Map<String, String> contact() {
        var out = new LinkedHashMap<String, String>();
        out.put("first_name", firstName); out.put("last_name", lastName); out.put("company", company);
        out.put("address_1", address); out.put("address_2", addressDetail); out.put("city", city); out.put("state", state); out.put("country", "CO");
        return out;
    }
    private static String text(String raw, int min, int max, String message) {
        String value = optional(raw, max);
        if (value.length() < min) throw new IllegalArgumentException(message);
        return value;
    }
    private static String optional(String raw, int max) {
        String value = raw == null ? "" : raw.trim().replaceAll("\\s+", " ");
        if (value.length() > max) throw new IllegalArgumentException("Un dato es demasiado largo (máximo " + max + " caracteres)");
        if (value.indexOf('<') >= 0 || value.indexOf('>') >= 0) throw new IllegalArgumentException("Escribe los datos sin símbolos < o >");
        return value;
    }
}

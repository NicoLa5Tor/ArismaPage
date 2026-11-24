package dev.nortech.norpress.customers.domain;
import java.util.Locale;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * A saved delivery address of a customer, as Mercado Libre asks for it: who receives it and a phone, department, city,
 * neighbourhood, the street address, the flat or tower and notes for whoever delivers it. `id` is null until saved.
 */
public record Address(UUID id, Label label, String recipient, String phone, String state, String city, String neighborhood,
                      String street, String detail, String instructions, boolean isDefault) {
    public static final int MAX_PER_CUSTOMER = 10;
    private static final Pattern STATE = Pattern.compile("CO-[A-Z]{2,3}");

    public enum Label { CASA, TRABAJO, OTRO;
        public String db() { return name().toLowerCase(Locale.ROOT); }
        public static Label parse(String value) {
            if (value == null || value.isBlank()) return CASA;
            try { return valueOf(value.trim().toUpperCase(Locale.ROOT)); } catch (IllegalArgumentException e) { throw new IllegalArgumentException("Elige si es casa, trabajo u otro"); }
        }
    }

    public Address {
        if (label == null) label = Label.CASA;
        recipient = text(recipient, 2, 80, "Escribe el nombre de quien recibe");
        phone = phone == null ? "" : phone.replaceAll("[^0-9+]", "");
        if (phone.replace("+", "").length() < 7 || phone.length() > 16) throw new IllegalArgumentException("Escribe un celular de contacto válido");
        state = state == null ? "" : state.trim().toUpperCase(Locale.ROOT);
        if (!STATE.matcher(state).matches()) throw new IllegalArgumentException("Elige el departamento");
        city = text(city, 2, 60, "Escribe el municipio o la ciudad");
        neighborhood = optional(neighborhood, 60);
        street = text(street, 5, 120, "Escribe la dirección, por ejemplo Calle 10 # 20-30");
        detail = optional(detail, 80);
        instructions = optional(instructions, 200);
    }

    public Address withId(UUID newId, boolean asDefault) { return new Address(newId, label, recipient, phone, state, city, neighborhood, street, detail, instructions, asDefault); }

    /** First name and the rest, for the orders' first_name / last_name. */
    public String firstName() { int i = recipient.indexOf(' '); return i < 0 ? recipient : recipient.substring(0, i); }
    public String lastName() { int i = recipient.indexOf(' '); return i < 0 ? "" : recipient.substring(i + 1); }

    private static String text(String raw, int min, int max, String message) {
        String value = optional(raw, max);
        if (value.length() < min) throw new IllegalArgumentException(message);
        return value;
    }
    private static String optional(String raw, int max) {
        String value = raw == null ? "" : raw.trim().replaceAll("\\s+", " ");
        if (value.length() > max) throw new IllegalArgumentException("Un dato de la dirección es demasiado largo (máximo " + max + " caracteres)");
        if (value.indexOf('<') >= 0 || value.indexOf('>') >= 0) throw new IllegalArgumentException("Escribe la dirección sin símbolos < o >");
        return value;
    }
}

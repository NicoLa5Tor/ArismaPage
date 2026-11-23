package co.com.arisma.customers.domain;
import java.util.Locale;
import java.util.regex.Pattern;

/** What a shopper gives to open a store account: a name to sign reviews with, an email and a password. */
public record ShopperSignup(String name, String email, String password) {
    public static final int MIN_PASSWORD = 8, MAX_PASSWORD = 128, MAX_NAME = 80;
    private static final Pattern EMAIL = Pattern.compile("[^@\\s<>]+@[^@\\s<>]+\\.[^@\\s<>]{2,}");

    public ShopperSignup {
        name = cleanName(name);
        email = cleanEmail(email);
        checkPassword(password, email);
    }
    /** The same rules for a new account, a changed password and a reset one. */
    public static void checkPassword(String password, String email) {
        if (password == null || password.length() < MIN_PASSWORD) throw new IllegalArgumentException("La contraseña debe tener al menos " + MIN_PASSWORD + " caracteres");
        if (password.length() > MAX_PASSWORD) throw new IllegalArgumentException("La contraseña admite máximo " + MAX_PASSWORD + " caracteres");
        if (password.chars().distinct().count() < 4) throw new IllegalArgumentException("La contraseña es demasiado repetitiva");
        if (password.equalsIgnoreCase(email)) throw new IllegalArgumentException("La contraseña no puede ser tu correo");
    }
    public static String cleanEmail(String raw) {
        String email = raw == null ? "" : raw.trim().toLowerCase(Locale.ROOT);
        if (email.length() > 254 || !EMAIL.matcher(email).matches()) throw new IllegalArgumentException("Escribe un correo válido");
        return email;
    }
    public static String cleanName(String raw) {
        String name = raw == null ? "" : raw.trim().replaceAll("\\s+", " ");
        if (name.length() < 2) throw new IllegalArgumentException("Escribe tu nombre");
        if (name.length() > MAX_NAME) throw new IllegalArgumentException("El nombre admite máximo " + MAX_NAME + " caracteres");
        if (name.indexOf('<') >= 0 || name.indexOf('>') >= 0 || name.contains("://")) throw new IllegalArgumentException("El nombre solo lleva letras");
        return name;
    }
    /** A name for accounts created by an identity provider that did not send one: the part of the email before the @. */
    public static String nameFrom(String name, String email) {
        try { return cleanName(name); } catch (IllegalArgumentException e) { String local = email.split("@")[0]; return local.length() >= 2 ? local : "Cliente"; }
    }
}

package dev.nortech.norpress.identity.domain;
import java.util.Locale;

/** Long passphrases beat complexity rules: at least 12 characters, not the email, not one repeated character. */
public final class PasswordPolicy {
    public static final int MIN = 12, MAX = 128;
    private PasswordPolicy() {}
    public static void require(String password, String email) {
        if (password == null || password.length() < MIN) throw new IllegalArgumentException("La contraseña debe tener al menos " + MIN + " caracteres");
        if (password.length() > MAX) throw new IllegalArgumentException("La contraseña admite máximo " + MAX + " caracteres");
        if (password.chars().distinct().count() < 4) throw new IllegalArgumentException("La contraseña es demasiado repetitiva");
        if (email != null && password.toLowerCase(Locale.ROOT).contains(email.toLowerCase(Locale.ROOT).split("@")[0]) && email.split("@")[0].length() >= 4)
            throw new IllegalArgumentException("La contraseña no debe contener tu usuario de correo");
    }
}

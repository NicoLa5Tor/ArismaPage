package dev.nortech.norpress.identity.domain;
import java.util.Locale;
import java.util.UUID;
import java.util.regex.Pattern;

/** A person who signs in to the panel. Emails are stored lowercase. */
public record AdminAccount(UUID id, String email, String name, Role role, boolean active) {
    private static final Pattern EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
    public AdminAccount {
        if (id == null) throw new IllegalArgumentException("Identificador requerido");
        email = email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
        name = name == null ? "" : name.trim();
        if (!EMAIL.matcher(email).matches() || email.length() > 320) throw new IllegalArgumentException("Escribe un correo válido");
        if (name.length() < 2 || name.length() > 80) throw new IllegalArgumentException("Escribe el nombre (entre 2 y 80 caracteres)");
        if (role == null) throw new IllegalArgumentException("Elige un rol");
    }

    /**
     * Rules for changing someone else's account: nobody can lock themselves out, and the panel always keeps an active administrator.
     * @param activeAdmins active administrators right now, including the current state of this account
     */
    public void requireChangeAllowed(AdminAccount current, UUID actor, long activeAdmins) {
        boolean self = id.equals(actor);
        if (self && !active) throw new IllegalArgumentException("No puedes desactivar tu propia cuenta");
        if (self && current.role() == Role.ADMIN && role != Role.ADMIN) throw new IllegalArgumentException("No puedes quitarte el rol de administrador");
        boolean losesAdmin = current.role() == Role.ADMIN && current.active() && (role != Role.ADMIN || !active);
        if (losesAdmin && activeAdmins <= 1) throw new IllegalArgumentException("Debe quedar al menos un administrador activo");
    }
}

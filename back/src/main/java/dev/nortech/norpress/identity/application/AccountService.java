package dev.nortech.norpress.identity.application;
import dev.nortech.norpress.identity.application.IdentityPorts.*;
import dev.nortech.norpress.identity.domain.PasswordPolicy;
import dev.nortech.norpress.shared.domain.NotFound;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import java.util.UUID;

/** The signed-in user's own account. */
@ApplicationScoped
public class AccountService {
    @Inject UserRepository users;
    @Inject SessionRepository sessions;
    @Inject PasswordHasher hasher;
    @Inject Secrets secrets;
    /** Changing the password keeps this session and closes the others. */
    @Transactional
    public void changePassword(UUID userId, String current, String next, String sessionToken) {
        var user = users.lock(userId).orElseThrow(() -> new NotFound("Usuario no encontrado"));
        if (current == null || !hasher.verify(current, user.passwordHash())) throw new IllegalArgumentException("La contraseña actual no es correcta");
        PasswordPolicy.require(next, user.account().email());
        if (hasher.verify(next, user.passwordHash())) throw new IllegalArgumentException("La nueva contraseña debe ser distinta de la actual");
        users.setPassword(userId, hasher.hash(next), false);
        sessions.deleteForUserExcept(userId, secrets.digest(sessionToken));
    }
}

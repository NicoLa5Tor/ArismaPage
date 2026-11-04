package co.com.arisma.identity.application;
import co.com.arisma.identity.application.IdentityPorts.*;
import co.com.arisma.identity.domain.AdminAccount;
import co.com.arisma.identity.domain.LoginGuard;
import co.com.arisma.identity.domain.Role;
import co.com.arisma.shared.domain.Conflict;
import co.com.arisma.shared.domain.NotFound;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import java.util.*;

/**
 * User administration. New and reset accounts get a temporary password that is shown once and must be changed at first sign-in.
 * Deactivating a user or changing their role closes their open sessions.
 */
@ApplicationScoped
public class UserService {
    /** Result that carries the one-time temporary password next to the user's data. */
    public record WithPassword(Map<String, Object> user, String temporaryPassword) {}
    @Inject UserRepository users;
    @Inject SessionRepository sessions;
    @Inject PasswordHasher hasher;
    @Inject Secrets secrets;

    @Transactional
    public WithPassword create(String email, String name, Role role, UUID actor) {
        var account = new AdminAccount(UUID.randomUUID(), email, name, role, true);
        if (users.findByEmail(account.email()).isPresent()) throw new Conflict("Ya existe un usuario con ese correo");
        String temporary = secrets.temporaryPassword();
        users.insert(account, hasher.hash(temporary), actor);
        return new WithPassword(users.view(account.id()).orElseThrow(), temporary);
    }
    @Transactional
    public Map<String, Object> update(UUID id, String name, Role role, boolean active, UUID actor) {
        var current = users.lock(id).orElseThrow(() -> new NotFound("Usuario no encontrado")).account();
        var next = new AdminAccount(id, current.email(), name, role, active);
        next.requireChangeAllowed(current, actor, users.activeAdmins());
        users.update(next);
        if (current.role() != next.role() || (current.active() && !next.active())) sessions.deleteForUser(id);
        return users.view(id).orElseThrow();
    }
    /** Also unlocks the account and signs it out everywhere. */
    @Transactional
    public WithPassword resetPassword(UUID id, UUID actor) {
        users.lock(id).orElseThrow(() -> new NotFound("Usuario no encontrado"));
        String temporary = secrets.temporaryPassword();
        users.setPassword(id, hasher.hash(temporary), true);
        users.saveGuard(id, LoginGuard.clear());
        sessions.deleteForUser(id);
        return new WithPassword(users.view(id).orElseThrow(), temporary);
    }
    @Transactional
    public void closeSessions(UUID id, UUID actor) {
        users.lock(id).orElseThrow(() -> new NotFound("Usuario no encontrado"));
        sessions.deleteForUser(id);
    }
}

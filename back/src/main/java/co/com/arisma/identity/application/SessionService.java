package co.com.arisma.identity.application;
import co.com.arisma.identity.application.IdentityPorts.*;
import co.com.arisma.identity.domain.LoginGuard;
import co.com.arisma.shared.domain.Forbidden;
import co.com.arisma.shared.domain.Unauthorized;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;

/** Sign-in, session restore and sign-out. Sessions last 8 hours; the cookie token and CSRF token are stored only as digests. */
@ApplicationScoped
public class SessionService {
    public static final Duration TTL = Duration.ofHours(8);
    static final String INVALID = "Correo o contraseña incorrectos";
    public record Issued(String token, String csrf, Principal user) {}
    @Inject UserRepository users;
    @Inject SessionRepository sessions;
    @Inject PasswordHasher hasher;
    @Inject Secrets secrets;
    Clock clock = Clock.systemUTC();

    /** Same answer for unknown email and wrong password, so the form does not reveal which accounts exist. */
    @Transactional(dontRollbackOn = { Unauthorized.class, Forbidden.class })
    public Issued login(String email, String password) {
        if (email == null || password == null || email.length() > 320 || password.length() > 1024) throw new Unauthorized(INVALID);
        Instant now = clock.instant();
        var found = users.findByEmail(email.trim().toLowerCase());
        if (found.isEmpty()) { hasher.verify(password, DUMMY); throw new Unauthorized(INVALID); }
        var user = found.get();
        if (user.guard().locked(now)) throw locked(user.guard(), now);
        if (!hasher.verify(password, user.passwordHash())) {
            var guard = user.guard().afterFailure(now);
            users.saveGuard(user.account().id(), guard);
            if (guard.locked(now)) throw locked(guard, now);
            throw new Unauthorized(INVALID);
        }
        if (!user.account().active()) throw new Unauthorized("Tu cuenta está desactivada. Pide acceso a un administrador.");
        users.saveGuard(user.account().id(), LoginGuard.clear());
        users.recordLogin(user.account().id(), now);
        String token = secrets.token(), csrf = csrfFor(token);
        sessions.create(secrets.digest(token), user.account().id(), secrets.digest(csrf), now.plus(TTL));
        return new Issued(token, csrf, principal(user));
    }

    /**
     * Restoring returns the same CSRF token for the whole session, so several tabs of the panel keep working.
     * It is derived from the session token, which the browser keeps in an httpOnly, SameSite=Strict cookie.
     */
    public Issued restore(String token) {
        var user = authenticate(token, null, false).orElseThrow(() -> new Unauthorized("Sesión requerida"));
        return new Issued(token, csrfFor(token), user);
    }
    String csrfFor(String token) { return secrets.digest("csrf:" + token); }
    @Transactional
    public void logout(String token, String csrf) {
        authenticate(token, csrf, true).orElseThrow(() -> new Unauthorized("Sesión requerida"));
        sessions.delete(secrets.digest(token));
    }
    /** Writes also need the CSRF token. Deactivated users lose access immediately. */
    public Optional<Principal> authenticate(String token, String csrf, boolean write) {
        if (token == null || token.length() > 128 || (write && (csrf == null || csrf.length() > 128))) return Optional.empty();
        var session = sessions.find(secrets.digest(token), clock.instant());
        if (session.isEmpty() || (write && !java.security.MessageDigest.isEqual(csrf.getBytes(java.nio.charset.StandardCharsets.UTF_8), csrfFor(token).getBytes(java.nio.charset.StandardCharsets.UTF_8)))) return Optional.empty();
        return users.find(session.get().userId()).filter(u -> u.account().active()).map(SessionService::principal);
    }
    static Principal principal(StoredUser u) { return new Principal(u.account().id(), u.account().name(), u.account().email(), u.account().role(), u.mustChangePassword()); }
    private static Forbidden locked(LoginGuard guard, Instant now) {
        long minutes = Math.max(1, (guard.secondsLeft(now) + 59) / 60);
        return new Forbidden("Demasiados intentos fallidos. Intenta de nuevo en " + minutes + (minutes == 1 ? " minuto." : " minutos."), guard.secondsLeft(now));
    }
    /** Valid hash of a random password, verified when the email is unknown so both paths take similar time. */
    static final String DUMMY = "pbkdf2-sha256$600000$00000000000000000000000000000000$0000000000000000000000000000000000000000000000000000000000000000";
}

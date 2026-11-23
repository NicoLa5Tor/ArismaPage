package co.com.arisma.customers.application;
import co.com.arisma.customers.application.ShopperPorts.*;
import co.com.arisma.customers.domain.ShopperSignup;
import co.com.arisma.identity.application.IdentityPorts.PasswordHasher;
import co.com.arisma.identity.application.IdentityPorts.Secrets;
import co.com.arisma.identity.domain.LoginGuard;
import co.com.arisma.shared.domain.Forbidden;
import co.com.arisma.shared.domain.Unauthorized;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;

/**
 * Store accounts: sign up, sign in (password or a verified identity), restore and sign out. Sessions last 30 days;
 * the cookie token is stored only as a digest and the CSRF token is derived from it, as in the panel.
 */
@ApplicationScoped
public class ShopperAuthService {
    public static final Duration TTL = Duration.ofDays(30);
    static final String INVALID = "Correo o contraseña incorrectos";
    public record Issued(String token, String csrf, Shopper shopper) {}
    @Inject ShopperRepository shoppers;
    @Inject PasswordHasher hasher;
    @Inject Secrets secrets;
    Clock clock = Clock.systemUTC();

    @Transactional
    public Issued register(String name, String email, String password) {
        var signup = new ShopperSignup(name, email, password);
        return issue(shoppers.create(signup.name(), signup.email(), hasher.hash(signup.password()), false));
    }

    /** Same answer for an unknown email and a wrong password; five failures lock the account for 15 minutes. */
    @Transactional(dontRollbackOn = { Unauthorized.class, Forbidden.class })
    public Issued login(String email, String password) {
        if (email == null || password == null || email.length() > 320 || password.length() > 1024) throw new Unauthorized(INVALID);
        Instant now = clock.instant();
        var found = shoppers.findByEmail(email.trim().toLowerCase(java.util.Locale.ROOT));
        if (found.isEmpty() || found.get().passwordHash() == null) { hasher.verify(password, DUMMY); throw new Unauthorized(found.isPresent() ? "Esta cuenta entra con Google o Facebook" : INVALID); }
        var stored = found.get();
        if (stored.guard().locked(now)) throw locked(stored.guard(), now);
        if (!hasher.verify(password, stored.passwordHash())) {
            var guard = stored.guard().afterFailure(now);
            shoppers.saveGuard(stored.shopper().accountId(), guard);
            if (guard.locked(now)) throw locked(guard, now);
            throw new Unauthorized(INVALID);
        }
        shoppers.saveGuard(stored.shopper().accountId(), LoginGuard.clear());
        return issue(stored.shopper());
    }

    /** An identity provider vouched for this email: the account is created on first use and marked verified. */
    @Transactional
    public Issued loginVerified(String email, String name) {
        String clean = ShopperSignup.cleanEmail(email);
        var found = shoppers.findByEmail(clean);
        Shopper shopper;
        if (found.isPresent()) {
            shopper = found.get().shopper();
            if (!shopper.emailVerified()) { shoppers.markVerifiedByProvider(shopper.accountId()); shopper = new Shopper(shopper.accountId(), shopper.customerId(), shopper.name(), shopper.email(), true); }
        } else shopper = shoppers.create(ShopperSignup.nameFrom(name, clean), clean, null, true);
        return issue(shopper);
    }

    public Issued restore(String token) {
        var shopper = authenticate(token, null, false).orElseThrow(() -> new Unauthorized("Inicia sesión para continuar"));
        return new Issued(token, csrfFor(token), shopper);
    }
    @Transactional
    public void logout(String token, String csrf) {
        authenticate(token, csrf, true).orElseThrow(() -> new Unauthorized("Inicia sesión para continuar"));
        shoppers.deleteSession(secrets.digest(token));
    }
    /** Who the cookie belongs to; writes also need the CSRF token. */
    public Optional<Shopper> authenticate(String token, String csrf, boolean write) {
        if (token == null || token.isBlank() || token.length() > 128 || (write && (csrf == null || csrf.length() > 128))) return Optional.empty();
        if (write && !MessageDigest.isEqual(csrf.getBytes(StandardCharsets.UTF_8), csrfFor(token).getBytes(StandardCharsets.UTF_8))) return Optional.empty();
        return shoppers.sessionAccount(secrets.digest(token), clock.instant()).flatMap(shoppers::find).map(StoredShopper::shopper);
    }

    private Issued issue(Shopper shopper) {
        Instant now = clock.instant();
        shoppers.recordLogin(shopper.accountId(), now);
        String token = secrets.token();
        shoppers.createSession(secrets.digest(token), shopper.accountId(), now.plus(TTL));
        return new Issued(token, csrfFor(token), shopper);
    }
    String csrfFor(String token) { return secrets.digest("shop-csrf:" + token); }
    private static Forbidden locked(LoginGuard guard, Instant now) {
        long minutes = Math.max(1, (guard.secondsLeft(now) + 59) / 60);
        return new Forbidden("Demasiados intentos fallidos. Intenta de nuevo en " + minutes + (minutes == 1 ? " minuto." : " minutos."), guard.secondsLeft(now));
    }
    static final String DUMMY = "pbkdf2-sha256$600000$00000000000000000000000000000000$0000000000000000000000000000000000000000000000000000000000000000";
}

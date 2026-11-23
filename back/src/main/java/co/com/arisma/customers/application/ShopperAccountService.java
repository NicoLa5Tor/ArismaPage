package co.com.arisma.customers.application;
import co.com.arisma.customers.application.ShopperPorts.*;
import co.com.arisma.customers.domain.ShopperSignup;
import co.com.arisma.identity.application.IdentityPorts.PasswordHasher;
import co.com.arisma.identity.application.IdentityPorts.Secrets;
import co.com.arisma.notifications.application.NotificationService;
import co.com.arisma.shared.domain.Forbidden;
import co.com.arisma.shared.domain.Unauthorized;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;

/**
 * What a signed-in shopper does with their account (name, password, sessions) and the two email links: confirm the
 * address and choose a new password. `site` is the store's own address, from the server configuration.
 */
@ApplicationScoped
public class ShopperAccountService {
    static final Duration VERIFY_TTL = Duration.ofHours(24), RESET_TTL = Duration.ofHours(1);
    static final int MAX_LINKS_PER_HOUR = 3;
    @Inject ShopperRepository shoppers;
    @Inject TokenRepository tokens;
    @Inject PasswordHasher hasher;
    @Inject Secrets secrets;
    @Inject NotificationService notifications;
    Clock clock = Clock.systemUTC();

    @Transactional
    public Shopper rename(Shopper shopper, String name) {
        String clean = ShopperSignup.cleanName(name);
        shoppers.rename(shopper.accountId(), clean);
        return new Shopper(shopper.accountId(), shopper.customerId(), clean, shopper.email(), shopper.emailVerified());
    }

    /** An account made with Google or Facebook has no password: it can set one without the current. Other sessions are closed. */
    @Transactional(dontRollbackOn = Unauthorized.class)
    public void changePassword(Shopper shopper, String current, String next, String keepToken) {
        var stored = shoppers.find(shopper.accountId()).orElseThrow(() -> new Unauthorized("Inicia sesión para continuar"));
        if (stored.passwordHash() != null && (current == null || !hasher.verify(current, stored.passwordHash()))) throw new Unauthorized("Tu contraseña actual no es correcta");
        ShopperSignup.checkPassword(next, shopper.email());
        shoppers.setPassword(shopper.accountId(), hasher.hash(next));
        shoppers.deleteSessions(shopper.accountId(), keepToken == null ? null : secrets.digest(keepToken));
    }
    @Transactional
    public void logoutEverywhere(Shopper shopper) { shoppers.deleteSessions(shopper.accountId(), null); }

    /** Sends the confirmation link. Verified accounts do not need it. */
    @Transactional
    public void requestVerification(Shopper shopper, String site) {
        if (shopper.emailVerified()) throw new IllegalArgumentException("Tu correo ya está confirmado");
        throttle(shopper.accountId(), TokenPurpose.VERIFY);
        notifications.verifyEmail(shopper.email(), shopper.name(), site + "/cuenta/verificar?token=" + enc(issue(shopper.accountId(), TokenPurpose.VERIFY, VERIFY_TTL)));
    }
    @Transactional
    public void confirmEmail(String token) {
        var account = tokens.consume(digest(token), TokenPurpose.VERIFY, clock.instant()).orElseThrow(() -> new IllegalArgumentException("El enlace ya se usó o venció. Pide otro desde tu cuenta."));
        shoppers.confirmEmail(account);
    }

    /** Always answers the same, whether the email has an account or not, so the form does not reveal who is a customer. */
    @Transactional
    public void requestReset(String email, String site) {
        String clean;
        try { clean = ShopperSignup.cleanEmail(email); } catch (IllegalArgumentException e) { throw e; }
        var found = shoppers.findByEmail(clean);
        if (found.isEmpty()) return;
        var shopper = found.get().shopper();
        if (tokens.issuedSince(shopper.accountId(), TokenPurpose.RESET, clock.instant().minus(Duration.ofHours(1))) >= MAX_LINKS_PER_HOUR) return;
        notifications.resetPassword(shopper.email(), shopper.name(), site + "/cuenta/restablecer?token=" + enc(issue(shopper.accountId(), TokenPurpose.RESET, RESET_TTL)));
    }
    /** Opening the link proves the address, so it is confirmed too; every session closes. */
    @Transactional
    public void resetPassword(String token, String next) {
        var account = tokens.consume(digest(token), TokenPurpose.RESET, clock.instant()).orElseThrow(() -> new IllegalArgumentException("El enlace ya se usó o venció. Pide uno nuevo."));
        var stored = shoppers.find(account).orElseThrow(() -> new IllegalArgumentException("La cuenta ya no existe"));
        ShopperSignup.checkPassword(next, stored.shopper().email());
        shoppers.setPassword(account, hasher.hash(next));
        shoppers.confirmEmail(account);
        shoppers.deleteSessions(account, null);
    }

    private String issue(java.util.UUID account, TokenPurpose purpose, Duration ttl) {
        String token = secrets.token();
        tokens.issue(secrets.digest(token), account, purpose, clock.instant().plus(ttl));
        return token;
    }
    private void throttle(java.util.UUID account, TokenPurpose purpose) {
        if (tokens.issuedSince(account, purpose, clock.instant().minus(Duration.ofHours(1))) >= MAX_LINKS_PER_HOUR) throw new Forbidden("Ya te enviamos varios enlaces. Revisa tu correo o intenta en una hora.", 3600);
    }
    private String digest(String token) {
        if (token == null || token.isBlank() || token.length() > 128) throw new IllegalArgumentException("Enlace inválido");
        return secrets.digest(token.trim());
    }
    private static String enc(String value) { return URLEncoder.encode(value, StandardCharsets.UTF_8); }
}

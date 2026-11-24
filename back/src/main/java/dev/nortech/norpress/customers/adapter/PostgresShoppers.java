package dev.nortech.norpress.customers.adapter;
import dev.nortech.norpress.customers.application.ShopperPorts.*;
import dev.nortech.norpress.identity.domain.LoginGuard;
import dev.nortech.norpress.shared.adapter.Jdbc;
import dev.nortech.norpress.shared.domain.Conflict;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import javax.sql.DataSource;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@ApplicationScoped
public class PostgresShoppers implements ShopperRepository {
    private static final String ACCOUNT = "SELECT id, customer_id, email, name, password_hash, email_verified, failed_attempts, locked_until FROM customer_account";
    @Inject DataSource db;

    private static StoredShopper stored(Map<String, Object> r) {
        return new StoredShopper(new Shopper((UUID) r.get("id"), (UUID) r.get("customerId"), (String) r.get("name"), (String) r.get("email"), (Boolean) r.get("emailVerified")),
            (String) r.get("passwordHash"), new LoginGuard(((Number) r.get("failedAttempts")).intValue(), (Instant) r.get("lockedUntil")));
    }
    public Optional<StoredShopper> findByEmail(String email) { return Jdbc.with(db, c -> Jdbc.one(c, ACCOUNT + " WHERE lower(email)=lower(?)", email).map(PostgresShoppers::stored)); }
    public Optional<StoredShopper> find(UUID accountId) { return Jdbc.with(db, c -> Jdbc.one(c, ACCOUNT + " WHERE id=?", accountId).map(PostgresShoppers::stored)); }

    public Shopper create(String name, String email, String passwordHash, boolean emailVerified) {
        UUID accountId = UUID.randomUUID();
        try {
            return Jdbc.with(db, c -> {
                // an existing customer with that email (imported history or a guest order) is linked, not duplicated
                UUID customerId = Jdbc.one(c, "SELECT id FROM customer WHERE lower(email)=lower(?) FOR UPDATE", email).map(r -> (UUID) r.get("id")).orElse(null);
                if (customerId == null) {
                    customerId = UUID.randomUUID();
                    int space = name.indexOf(' ');
                    Jdbc.update(c, "INSERT INTO customer(id,email,first_name,last_name,has_account) VALUES(?,?,?,?,true)", customerId, email, space < 0 ? name : name.substring(0, space), space < 0 ? "" : name.substring(space + 1));
                } else Jdbc.update(c, "UPDATE customer SET has_account=true, updated_at=now() WHERE id=?", customerId);
                Jdbc.update(c, "INSERT INTO customer_account(id,customer_id,email,name,password_hash,email_verified) VALUES(?,?,?,?,?,?)", accountId, customerId, email, name, passwordHash, emailVerified);
                return new Shopper(accountId, customerId, name, email, emailVerified);
            });
        } catch (IllegalStateException e) {
            if (Jdbc.duplicate(e)) throw new Conflict("Ya existe una cuenta con ese correo. Inicia sesión.");
            throw e;
        }
    }
    public void markVerifiedByProvider(UUID accountId) {
        Jdbc.with(db, c -> { Jdbc.update(c, "DELETE FROM customer_session WHERE account_id=?", accountId); return Jdbc.update(c, "UPDATE customer_account SET email_verified=true, password_hash=NULL, failed_attempts=0, locked_until=NULL WHERE id=?", accountId); });
    }
    public void saveGuard(UUID accountId, LoginGuard guard) { Jdbc.with(db, c -> Jdbc.update(c, "UPDATE customer_account SET failed_attempts=?, locked_until=? WHERE id=?", guard.failedAttempts(), guard.lockedUntil(), accountId)); }
    public void recordLogin(UUID accountId, Instant at) { Jdbc.with(db, c -> Jdbc.update(c, "UPDATE customer_account SET last_login_at=? WHERE id=?", at, accountId)); }
    public void createSession(String tokenHash, UUID accountId, Instant expiresAt) {
        Jdbc.with(db, c -> { Jdbc.update(c, "DELETE FROM customer_session WHERE expires_at < now()"); return Jdbc.update(c, "INSERT INTO customer_session(token_hash,account_id,expires_at) VALUES(?,?,?)", tokenHash, accountId, expiresAt); });
    }
    public Optional<UUID> sessionAccount(String tokenHash, Instant now) {
        return Jdbc.with(db, c -> Jdbc.one(c, "SELECT account_id FROM customer_session WHERE token_hash=? AND expires_at>?", tokenHash, now).map(r -> (UUID) r.get("accountId")));
    }
    public void extendSession(String tokenHash, Instant expiresAt, Instant renewBefore) {
        Jdbc.with(db, c -> Jdbc.update(c, "UPDATE customer_session SET expires_at=? WHERE token_hash=? AND expires_at>now() AND expires_at<?", expiresAt, tokenHash, renewBefore));
    }
    public void deleteSession(String tokenHash) { Jdbc.with(db, c -> Jdbc.update(c, "DELETE FROM customer_session WHERE token_hash=?", tokenHash)); }
    public void deleteSessions(UUID accountId, String keepTokenHash) {
        Jdbc.with(db, c -> Jdbc.update(c, "DELETE FROM customer_session WHERE account_id=? AND (?::text IS NULL OR token_hash<>?)", accountId, keepTokenHash, keepTokenHash));
    }
    public void confirmEmail(UUID accountId) { Jdbc.with(db, c -> Jdbc.update(c, "UPDATE customer_account SET email_verified=true WHERE id=?", accountId)); }
    public void rename(UUID accountId, String name) { Jdbc.with(db, c -> Jdbc.update(c, "UPDATE customer_account SET name=? WHERE id=?", name, accountId)); }
    public void setPassword(UUID accountId, String passwordHash) {
        Jdbc.with(db, c -> Jdbc.update(c, "UPDATE customer_account SET password_hash=?, failed_attempts=0, locked_until=NULL WHERE id=?", passwordHash, accountId));
    }
}

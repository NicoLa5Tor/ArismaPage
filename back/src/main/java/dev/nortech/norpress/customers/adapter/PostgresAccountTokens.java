package dev.nortech.norpress.customers.adapter;
import dev.nortech.norpress.customers.application.ShopperPorts.TokenPurpose;
import dev.nortech.norpress.customers.application.ShopperPorts.TokenRepository;
import dev.nortech.norpress.shared.adapter.Jdbc;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import javax.sql.DataSource;
import java.time.Instant;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

@ApplicationScoped
public class PostgresAccountTokens implements TokenRepository {
    @Inject DataSource db;
    public void issue(String tokenHash, UUID accountId, TokenPurpose purpose, Instant expiresAt) {
        Jdbc.with(db, c -> { Jdbc.update(c, "DELETE FROM account_token WHERE expires_at < now() - interval '7 days'");
            return Jdbc.update(c, "INSERT INTO account_token(token_hash,account_id,purpose,expires_at) VALUES(?,?,?,?)", tokenHash, accountId, purpose.name().toLowerCase(Locale.ROOT), expiresAt); });
    }
    /** One statement: two clicks on the same link cannot both succeed. */
    public Optional<UUID> consume(String tokenHash, TokenPurpose purpose, Instant now) {
        return Jdbc.with(db, c -> Jdbc.one(c, "UPDATE account_token SET used_at=? WHERE token_hash=? AND purpose=? AND used_at IS NULL AND expires_at>? RETURNING account_id",
            now, tokenHash, purpose.name().toLowerCase(Locale.ROOT), now).map(r -> (UUID) r.get("accountId")));
    }
    public long issuedSince(UUID accountId, TokenPurpose purpose, Instant since) {
        return Jdbc.with(db, c -> Jdbc.count(c, "SELECT count(*) AS n FROM account_token WHERE account_id=? AND purpose=? AND created_at>?", accountId, purpose.name().toLowerCase(Locale.ROOT), since));
    }
}

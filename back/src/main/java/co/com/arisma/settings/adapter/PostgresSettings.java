package co.com.arisma.settings.adapter;
import co.com.arisma.settings.application.SettingsPorts.*;
import co.com.arisma.settings.domain.Gateway;
import co.com.arisma.shared.adapter.Jdbc;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import javax.sql.DataSource;
import java.util.*;

@ApplicationScoped
public class PostgresSettings implements SettingsRepository, CredentialRepository {
    private static final ObjectMapper JSON = new ObjectMapper();
    @Inject DataSource db;

    public Optional<Map<String, Object>> read(String key) {
        return Jdbc.with(db, c -> Jdbc.one(c, "SELECT value FROM store_setting WHERE key=?", key).map(row -> JSON.convertValue((JsonNode) row.get("value"), new TypeReference<Map<String, Object>>() {})));
    }
    public void write(String key, Map<String, Object> value, UUID actor) {
        Jdbc.with(db, c -> Jdbc.update(c, "INSERT INTO store_setting(key,value,updated_by) VALUES(?,?::jsonb,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_by=excluded.updated_by, updated_at=now()", key, json(value), actor));
    }
    public List<StoredCredentials> all() {
        return Jdbc.with(db, c -> Jdbc.list(c, "SELECT code, environment, public_config, secret_cipher FROM payment_credential").stream().map(row ->
            new StoredCredentials(Gateway.Code.parse((String) row.get("code")), "test".equals(row.get("environment")),
                JSON.convertValue((JsonNode) row.get("publicConfig"), new TypeReference<Map<String, String>>() {}), (String) row.get("secretCipher"))).toList());
    }
    public void save(StoredCredentials g, UUID actor) {
        Jdbc.with(db, c -> Jdbc.update(c, "INSERT INTO payment_credential(code,environment,public_config,secret_cipher,updated_by) VALUES(?,?,?::jsonb,?,?) "
            + "ON CONFLICT (code,environment) DO UPDATE SET public_config=excluded.public_config, secret_cipher=excluded.secret_cipher, updated_by=excluded.updated_by, updated_at=now()",
            g.code().db(), g.test() ? "test" : "live", json(g.config()), g.sealedSecrets(), actor));
    }
    private static String json(Object value) {
        try { return JSON.writeValueAsString(value); } catch (JsonProcessingException e) { throw new IllegalStateException(e); }
    }
}

package co.com.arisma.settings.application;
import co.com.arisma.settings.domain.Gateway;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/** Ports of the settings module, grouped because each is small. */
public final class SettingsPorts {
    private SettingsPorts() {}

    /** One JSON document per key. Empty when the administrator never saved that key. */
    public interface SettingsRepository {
        Optional<Map<String, Object>> read(String key);
        void write(String key, Map<String, Object> value, UUID actor);
    }
    /** Credentials of a payment method in one environment, as stored: secrets still sealed. */
    public record StoredCredentials(Gateway.Code code, boolean test, Map<String, String> config, String sealedSecrets) {}
    public interface CredentialRepository {
        List<StoredCredentials> all();
        void save(StoredCredentials credentials, UUID actor);
    }
    /** Encrypts secrets before they are stored. The key lives in the environment, never in the database. */
    public interface SecretVault {
        String seal(Map<String, String> secrets);
        Map<String, String> open(String sealed);
    }
}

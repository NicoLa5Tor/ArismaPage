package dev.nortech.norpress.settings.application;
import dev.nortech.norpress.settings.domain.Gateway;
import dev.nortech.norpress.settings.domain.LegalPages;
import java.time.Instant;
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

    /** A published legal page: never changed once written; acceptances point to it. */
    public record LegalVersion(UUID id, String kind, int version, LegalPages.LegalPage page, Instant publishedAt, UUID publishedBy) {}
    /** Someone accepting a version: on which occasion, of which order or account, and from where. */
    public record Acceptance(UUID versionId, String context, String orderNumber, UUID accountId, String ip, String userAgent) {}
    public interface LegalRepository {
        Optional<LegalVersion> latest(String kind);
        /** Every version of a kind, newest first. */
        List<LegalVersion> versions(String kind);
        /** Writes the page as the next version of its kind. Conflict when someone published that kind at the same moment. */
        LegalVersion publish(String kind, LegalPages.LegalPage page, UUID actor);
        void accept(List<Acceptance> acceptances);
        boolean accepted(UUID accountId, UUID versionId);
        /** What an account accepted, newest first: kind, version, context, order number, date (for the shopper's own data). */
        List<Map<String, Object>> acceptances(UUID accountId);
    }
}

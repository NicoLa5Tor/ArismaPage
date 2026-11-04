package co.com.arisma.identity.application;
import co.com.arisma.identity.domain.AdminAccount;
import co.com.arisma.identity.domain.LoginGuard;
import co.com.arisma.identity.domain.Role;
import co.com.arisma.shared.domain.Permission;
import java.time.Instant;
import java.util.*;

/** Ports of the identity module, grouped because each is small. */
public final class IdentityPorts {
    private IdentityPorts() {}

    /** Who is calling: what every other module needs to know about the signed-in user. */
    public record Principal(UUID userId, String name, String email, Role role, boolean mustChangePassword) {
        public Set<Permission> permissions() { return role.permissions(); }
        public boolean can(Permission p) { return role.can(p); }
    }
    public record StoredUser(AdminAccount account, String passwordHash, boolean mustChangePassword, LoginGuard guard) {}

    public interface UserRepository {
        Optional<StoredUser> findByEmail(String email);
        Optional<StoredUser> find(UUID id);
        /** Locks the row so concurrent admin edits see a consistent count of administrators. */
        Optional<StoredUser> lock(UUID id);
        List<Map<String, Object>> list();
        Optional<Map<String, Object>> view(UUID id);
        long activeAdmins();
        void insert(AdminAccount account, String passwordHash, UUID createdBy);
        void update(AdminAccount account);
        void setPassword(UUID id, String passwordHash, boolean mustChange);
        void saveGuard(UUID id, LoginGuard guard);
        void recordLogin(UUID id, Instant at);
    }
    public record SessionRecord(UUID userId, String csrfHash, Instant expiresAt) {}
    public interface SessionRepository {
        void create(String tokenHash, UUID userId, String csrfHash, Instant expiresAt);
        Optional<SessionRecord> find(String tokenHash, Instant now);
        void rotateCsrf(String tokenHash, String csrfHash);
        void delete(String tokenHash);
        void deleteForUser(UUID userId);
        void deleteForUserExcept(UUID userId, String keepTokenHash);
    }
    public interface PasswordHasher {
        String hash(String password);
        boolean verify(String password, String encoded);
    }
    /** Random tokens and one-way digests (session cookies are stored only as digests). */
    public interface Secrets {
        String token();
        /** Readable temporary password for a new or reset account. */
        String temporaryPassword();
        String digest(String value);
        boolean sameDigest(String value, String digest);
    }
}

package co.com.arisma.identity.application;
import static org.junit.jupiter.api.Assertions.*;
import co.com.arisma.identity.application.IdentityPorts.*;
import co.com.arisma.identity.domain.AdminAccount;
import co.com.arisma.identity.domain.LoginGuard;
import co.com.arisma.identity.domain.Role;
import co.com.arisma.shared.domain.Conflict;
import co.com.arisma.shared.domain.Forbidden;
import co.com.arisma.shared.domain.Unauthorized;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** Session, user and account use cases against in-memory adapters. */
class IdentityServicesTest {
    static class Store implements UserRepository, SessionRepository, PasswordHasher, Secrets {
        final Map<UUID, StoredUser> users = new LinkedHashMap<>(); final Map<String, SessionRecord> sessions = new HashMap<>(); int counter;
        public Optional<StoredUser> findByEmail(String e) { return users.values().stream().filter(u -> u.account().email().equals(e)).findFirst(); }
        public Optional<StoredUser> find(UUID id) { return Optional.ofNullable(users.get(id)); }
        public Optional<StoredUser> lock(UUID id) { return find(id); }
        public List<Map<String, Object>> list() { return List.of(); }
        public Optional<Map<String, Object>> view(UUID id) { return find(id).map(u -> Map.<String, Object>of("id", id, "role", u.account().role().db())); }
        public long activeAdmins() { return users.values().stream().filter(u -> u.account().active() && u.account().role() == Role.ADMIN).count(); }
        public void insert(AdminAccount a, String h, UUID by) { users.put(a.id(), new StoredUser(a, h, true, LoginGuard.clear())); }
        public void update(AdminAccount a) { var u = users.get(a.id()); users.put(a.id(), new StoredUser(a, u.passwordHash(), u.mustChangePassword(), u.guard())); }
        public void setPassword(UUID id, String h, boolean must) { var u = users.get(id); users.put(id, new StoredUser(u.account(), h, must, u.guard())); }
        public void saveGuard(UUID id, LoginGuard g) { var u = users.get(id); users.put(id, new StoredUser(u.account(), u.passwordHash(), u.mustChangePassword(), g)); }
        public void recordLogin(UUID id, Instant at) {}
        public void create(String t, UUID u, String c, Instant exp) { sessions.put(t, new SessionRecord(u, c, exp)); }
        public Optional<SessionRecord> find(String t, Instant now) { return Optional.ofNullable(sessions.get(t)).filter(s -> s.expiresAt().isAfter(now)); }
        public void rotateCsrf(String t, String c) { var s = sessions.get(t); sessions.put(t, new SessionRecord(s.userId(), c, s.expiresAt())); }
        public void delete(String t) { sessions.remove(t); }
        public void deleteForUser(UUID u) { sessions.values().removeIf(s -> s.userId().equals(u)); }
        public void deleteForUserExcept(UUID u, String keep) { sessions.entrySet().removeIf(e -> e.getValue().userId().equals(u) && !e.getKey().equals(keep)); }
        public String hash(String p) { return "h:" + p; }
        public boolean verify(String p, String enc) { return ("h:" + p).equals(enc); }
        public String token() { return "t" + (++counter); }
        public String temporaryPassword() { return "Temporal-" + (++counter) + "-xyzw"; }
        public String digest(String v) { return "d:" + v; }
        public boolean sameDigest(String v, String d) { return ("d:" + v).equals(d); }
    }
    Store store; SessionService sessions; UserService users; AccountService account; UUID admin;
    final Instant now = Instant.parse("2026-11-04T12:00:00Z");

    @BeforeEach void setUp() {
        store = new Store();
        sessions = new SessionService(); sessions.users = store; sessions.sessions = store; sessions.hasher = store; sessions.secrets = store; sessions.clock = Clock.fixed(now, ZoneOffset.UTC);
        users = new UserService(); users.users = store; users.sessions = store; users.hasher = store; users.secrets = store;
        account = new AccountService(); account.users = store; account.sessions = store; account.hasher = store; account.secrets = store;
        admin = UUID.randomUUID();
        store.users.put(admin, new StoredUser(new AdminAccount(admin, "jefe@arisma.com.co", "Jefe", Role.ADMIN, true), "h:clave-de-la-jefa", false, LoginGuard.clear()));
    }

    @Test void loginIssuesSessionAndAuthenticates() {
        var issued = sessions.login("JEFE@arisma.com.co", "clave-de-la-jefa");
        assertEquals(Role.ADMIN, sessions.authenticate(issued.token(), null, false).orElseThrow().role());
        assertTrue(sessions.authenticate(issued.token(), "otro", true).isEmpty(), "writes need the right CSRF token");
        assertTrue(sessions.authenticate(issued.token(), issued.csrf(), true).isPresent());
    }
    @Test void sameMessageForUnknownEmailAndWrongPassword() {
        var a = assertThrows(Unauthorized.class, () -> sessions.login("nadie@x.co", "x"));
        var b = assertThrows(Unauthorized.class, () -> sessions.login("jefe@arisma.com.co", "mala"));
        assertEquals(a.getMessage(), b.getMessage());
    }
    @Test void fifthFailureLocksEvenWithTheRightPassword() {
        for (int i = 0; i < 4; i++) assertThrows(Unauthorized.class, () -> sessions.login("jefe@arisma.com.co", "mala"));
        var locked = assertThrows(Forbidden.class, () -> sessions.login("jefe@arisma.com.co", "mala"));
        assertTrue(locked.retryAfterSeconds() > 0);
        assertThrows(Forbidden.class, () -> sessions.login("jefe@arisma.com.co", "clave-de-la-jefa"));
    }
    @Test void newSellerMustChangeTemporaryPassword() {
        var created = users.create("vende@arisma.com.co", "Vendedora", Role.SELLER, admin);
        var issued = sessions.login("vende@arisma.com.co", created.temporaryPassword());
        assertTrue(issued.user().mustChangePassword());
        assertThrows(Conflict.class, () -> users.create("vende@arisma.com.co", "Otra", Role.SELLER, admin));
        UUID id = issued.user().userId();
        account.changePassword(id, created.temporaryPassword(), "una frase larga y segura", issued.token());
        assertFalse(store.users.get(id).mustChangePassword());
        assertTrue(sessions.authenticate(issued.token(), null, false).isPresent(), "the current session survives");
    }
    @Test void deactivatingClosesSessionsAndBlocksLogin() {
        var created = users.create("vende@arisma.com.co", "Vendedora", Role.SELLER, admin);
        var issued = sessions.login("vende@arisma.com.co", created.temporaryPassword());
        users.update(issued.user().userId(), "Vendedora", Role.SELLER, false, admin);
        assertTrue(sessions.authenticate(issued.token(), null, false).isEmpty());
        assertThrows(Unauthorized.class, () -> sessions.login("vende@arisma.com.co", created.temporaryPassword()));
    }
    @Test void lastAdminStays() { assertThrows(IllegalArgumentException.class, () -> users.update(admin, "Jefe", Role.SELLER, true, UUID.randomUUID())); }
    @Test void resetUnlocksAndForcesChange() {
        for (int i = 0; i < 5; i++) { try { sessions.login("jefe@arisma.com.co", "mala"); } catch (RuntimeException ignored) { } }
        var reset = users.resetPassword(admin, admin);
        var issued = sessions.login("jefe@arisma.com.co", reset.temporaryPassword());
        assertTrue(issued.user().mustChangePassword());
    }
    @Test void restoreKeepsTheSameCsrfSoSeveralTabsWork() {
        var issued = sessions.login("jefe@arisma.com.co", "clave-de-la-jefa");
        var tab1 = sessions.restore(issued.token()); var tab2 = sessions.restore(issued.token());
        assertEquals(issued.csrf(), tab1.csrf()); assertEquals(tab1.csrf(), tab2.csrf());
        assertTrue(sessions.authenticate(issued.token(), tab1.csrf(), true).isPresent());
    }
}

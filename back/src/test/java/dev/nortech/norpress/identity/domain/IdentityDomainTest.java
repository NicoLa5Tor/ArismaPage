package dev.nortech.norpress.identity.domain;
import static org.junit.jupiter.api.Assertions.*;
import dev.nortech.norpress.shared.domain.Permission;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
class IdentityDomainTest {
    final UUID me = UUID.randomUUID(), other = UUID.randomUUID();
    AdminAccount account(UUID id, Role role, boolean active) { return new AdminAccount(id, "ana@tienda.test", "Ana Ruiz", role, active); }

    @Test void sellersRunOrdersButNotTheCatalog() {
        assertTrue(Role.SELLER.can(Permission.ORDERS_MANAGE)); assertTrue(Role.SELLER.can(Permission.QUOTES_MANAGE));
        for (var p : new Permission[]{Permission.CATALOG_EDIT, Permission.TAXES_MANAGE, Permission.COUPONS_MANAGE, Permission.USERS_MANAGE}) assertFalse(Role.SELLER.can(p), p.name());
        for (var p : Permission.values()) assertTrue(Role.ADMIN.can(p));
    }
    @Test void accountValidation() {
        assertThrows(IllegalArgumentException.class, () -> new AdminAccount(me, "no-es-correo", "Ana", Role.SELLER, true));
        assertThrows(IllegalArgumentException.class, () -> new AdminAccount(me, "ana@x.co", " ", Role.SELLER, true));
        assertEquals("ana@x.co", new AdminAccount(me, " ANA@X.CO ", "Ana", Role.SELLER, true).email());
    }
    @Test void cannotLockYourselfOut() {
        var current = account(me, Role.ADMIN, true);
        assertThrows(IllegalArgumentException.class, () -> account(me, Role.ADMIN, false).requireChangeAllowed(current, me, 3));
        assertThrows(IllegalArgumentException.class, () -> account(me, Role.SELLER, true).requireChangeAllowed(current, me, 3));
    }
    @Test void alwaysOneActiveAdmin() {
        var lastAdmin = account(other, Role.ADMIN, true);
        assertThrows(IllegalArgumentException.class, () -> account(other, Role.SELLER, true).requireChangeAllowed(lastAdmin, me, 1));
        assertThrows(IllegalArgumentException.class, () -> account(other, Role.ADMIN, false).requireChangeAllowed(lastAdmin, me, 1));
        assertDoesNotThrow(() -> account(other, Role.SELLER, true).requireChangeAllowed(lastAdmin, me, 2));
        assertDoesNotThrow(() -> account(other, Role.SELLER, false).requireChangeAllowed(account(other, Role.SELLER, true), me, 1));
    }
    @Test void passwordPolicy() {
        assertThrows(IllegalArgumentException.class, () -> PasswordPolicy.require("corta", "ana@x.co"));
        assertThrows(IllegalArgumentException.class, () -> PasswordPolicy.require("aaaaaaaaaaaaaa", "ana@x.co"));
        assertThrows(IllegalArgumentException.class, () -> PasswordPolicy.require("mariana-tienda-2026", "mariana@tienda.test"));
        assertDoesNotThrow(() -> PasswordPolicy.require("tablero verde mini arco", "ana@x.co"));
    }
    @Test void locksAfterFiveFailuresForFifteenMinutes() {
        var now = Instant.parse("2026-11-04T12:00:00Z");
        var g = LoginGuard.clear();
        for (int i = 0; i < 4; i++) { g = g.afterFailure(now); assertFalse(g.locked(now)); }
        g = g.afterFailure(now);
        assertTrue(g.locked(now)); assertTrue(g.locked(now.plusSeconds(899))); assertFalse(g.locked(now.plusSeconds(900)));
        assertEquals(1, g.afterFailure(now.plusSeconds(901)).failedAttempts(), "an expired lock starts a fresh count");
    }
}

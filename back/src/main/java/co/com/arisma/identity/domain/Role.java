package co.com.arisma.identity.domain;
import co.com.arisma.shared.domain.Permission;
import java.util.EnumSet;
import java.util.Locale;
import java.util.Set;

/** Panel roles. Sellers run the daily operation (orders, quotes, deliveries); administrators also manage catalog, prices, taxes, coupons and users. */
public enum Role {
    ADMIN(EnumSet.allOf(Permission.class)),
    SELLER(EnumSet.of(Permission.ORDERS_MANAGE, Permission.QUOTES_MANAGE, Permission.FULFILLMENT_MANAGE, Permission.REVIEWS_MANAGE));
    private final Set<Permission> permissions;
    Role(Set<Permission> permissions) { this.permissions = permissions; }
    public Set<Permission> permissions() { return EnumSet.copyOf(permissions); }
    public boolean can(Permission p) { return permissions.contains(p); }
    public String db() { return name().toLowerCase(Locale.ROOT); }
    public static Role parse(String value) {
        if (value == null || value.isBlank()) throw new IllegalArgumentException("Elige un rol");
        try { return valueOf(value.trim().toUpperCase(Locale.ROOT)); } catch (IllegalArgumentException e) { throw new IllegalArgumentException("Rol inválido"); }
    }
    public String label() { return this == ADMIN ? "Administrador" : "Vendedor"; }
}

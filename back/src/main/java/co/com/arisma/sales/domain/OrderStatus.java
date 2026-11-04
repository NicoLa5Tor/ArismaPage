package co.com.arisma.sales.domain;
import java.util.*;

/** WooCommerce-compatible order lifecycle. Paid statuses count as sales; cancelling or refunding returns stock. */
public enum OrderStatus {
    PENDING, ON_HOLD, PROCESSING, COMPLETED, CANCELLED, FAILED, REFUNDED;
    private static final Map<OrderStatus, Set<OrderStatus>> NEXT = Map.of(
        PENDING, EnumSet.of(PROCESSING, ON_HOLD, CANCELLED, FAILED),
        ON_HOLD, EnumSet.of(PROCESSING, CANCELLED),
        PROCESSING, EnumSet.of(COMPLETED, ON_HOLD, CANCELLED, REFUNDED),
        COMPLETED, EnumSet.of(REFUNDED),
        FAILED, EnumSet.of(PENDING, CANCELLED),
        CANCELLED, EnumSet.noneOf(OrderStatus.class),
        REFUNDED, EnumSet.noneOf(OrderStatus.class));
    public boolean paid() { return this == PROCESSING || this == COMPLETED || this == ON_HOLD; }
    public boolean canMoveTo(OrderStatus next) { return NEXT.get(this).contains(next); }
    /** Stock goes back to the shelf when an order that had reduced it leaves the sold states. */
    public boolean releasesStock() { return this == CANCELLED || this == REFUNDED || this == FAILED; }
    public String db() { return name().toLowerCase(Locale.ROOT); }
    public static OrderStatus fromDb(String value) { return valueOf(value.toUpperCase(Locale.ROOT)); }
    /** Parses an optional filter value; blank means any status. */
    public static OrderStatus parse(String value) {
        if (value == null || value.isBlank()) return null;
        try { return fromDb(value.trim()); } catch (IllegalArgumentException e) { throw new IllegalArgumentException("Estado de pedido inválido"); }
    }
    public void requireMoveTo(OrderStatus next) {
        if (next == null) throw new IllegalArgumentException("Indica el nuevo estado");
        if (!canMoveTo(next)) throw new IllegalArgumentException("No se puede pasar de " + label() + " a " + next.label());
    }
    public String label() {
        return switch (this) { case PENDING -> "pendiente de pago"; case ON_HOLD -> "en espera"; case PROCESSING -> "procesando"; case COMPLETED -> "completado"; case CANCELLED -> "cancelado"; case FAILED -> "fallido"; case REFUNDED -> "reembolsado"; };
    }
}

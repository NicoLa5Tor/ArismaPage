package dev.nortech.norpress.fulfillment.domain;
import java.util.*;

/**
 * Delivery lifecycle: pending (to prepare) → packed (packed / ready for pickup) → shipped (on its way) → delivered,
 * with failed (not delivered, with a reason) → shipped again or returned. Pickup skips "shipped".
 * Delivery can also be recorded straight from pending or packed, so a small team can close what it already handed over.
 * Cancelled is set only when the order itself is cancelled.
 */
public enum FulfillmentStatus {
    PENDING, PACKED, SHIPPED, DELIVERED, FAILED, RETURNED, CANCELLED;
    private static final Map<FulfillmentStatus, Set<FulfillmentStatus>> NEXT = Map.of(
        PENDING, EnumSet.of(PACKED, SHIPPED, DELIVERED),
        PACKED, EnumSet.of(PENDING, SHIPPED, DELIVERED),
        SHIPPED, EnumSet.of(DELIVERED, FAILED),
        FAILED, EnumSet.of(SHIPPED, RETURNED),
        DELIVERED, EnumSet.noneOf(FulfillmentStatus.class),
        RETURNED, EnumSet.noneOf(FulfillmentStatus.class),
        CANCELLED, EnumSet.noneOf(FulfillmentStatus.class));
    public String db() { return name().toLowerCase(Locale.ROOT); }
    public static FulfillmentStatus fromDb(String v) { return valueOf(v.toUpperCase(Locale.ROOT)); }
    public static FulfillmentStatus parse(String value) {
        if (value == null || value.isBlank()) return null;
        try { return fromDb(value.trim()); } catch (IllegalArgumentException e) { throw new IllegalArgumentException("Estado de entrega inválido"); }
    }
    /** Still needs work from the team. */
    public boolean open() { return this == PENDING || this == PACKED || this == SHIPPED || this == FAILED; }
    public boolean canMoveTo(FulfillmentStatus next, DeliveryMethod method) {
        if (method == DeliveryMethod.PICKUP && next == SHIPPED) return false;
        return NEXT.get(this).contains(next);
    }
    public String label() {
        return switch (this) { case PENDING -> "por preparar"; case PACKED -> "empacado"; case SHIPPED -> "en camino"; case DELIVERED -> "entregado"; case FAILED -> "no entregado"; case RETURNED -> "devuelto"; case CANCELLED -> "sin envío"; };
    }
}

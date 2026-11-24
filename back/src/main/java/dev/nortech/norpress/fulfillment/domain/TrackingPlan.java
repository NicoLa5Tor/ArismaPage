package dev.nortech.norpress.fulfillment.domain;
import java.util.Locale;

/**
 * How many shipments the store can follow automatically each calendar month (Bogotá time). The free plan comes with
 * the store; the paid one (5 USD a month) is switched on by whoever runs the server once it is paid.
 */
public enum TrackingPlan {
    FREE("Gratis", 10), PLUS("Plus", 50);
    public final String label;
    public final int monthlyShipments;
    TrackingPlan(String label, int monthlyShipments) { this.label = label; this.monthlyShipments = monthlyShipments; }
    public static TrackingPlan parse(String value) {
        if (value == null || value.isBlank()) return FREE;
        try { return valueOf(value.trim().toUpperCase(Locale.ROOT)); } catch (IllegalArgumentException e) { return FREE; }
    }
    public String db() { return name().toLowerCase(Locale.ROOT); }
}

package co.com.arisma.fulfillment.domain;

/** This month's use of the plan. A shipment counts once, when the carrier starts being followed. */
public record TrackingQuota(TrackingPlan plan, int used) {
    public TrackingQuota { if (plan == null) plan = TrackingPlan.FREE; used = Math.max(0, used); }
    public int limit() { return plan.monthlyShipments; }
    public int remaining() { return Math.max(0, limit() - used); }
    public boolean exhausted() { return remaining() == 0; }
}

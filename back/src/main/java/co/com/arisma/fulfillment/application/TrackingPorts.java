package co.com.arisma.fulfillment.application;
import co.com.arisma.fulfillment.domain.TrackingEvent;
import co.com.arisma.fulfillment.domain.TrackingPlan;
import co.com.arisma.fulfillment.domain.TrackingStage;
import java.time.Duration;
import java.time.Instant;
import java.util.*;

/** Ports of automatic carrier tracking. */
public final class TrackingPorts {
    private TrackingPorts() {}

    /** A tracking number as the provider wants it; carrierKey null lets the provider detect the carrier. */
    public record Parcel(String number, Integer carrierKey) {}
    /** Outcome of starting to follow one number. quotaExhausted: the provider's own account ran out. */
    public record Registration(String number, boolean accepted, String error, boolean quotaExhausted) {}
    /** What the carrier says today about one number. */
    public record Report(String number, TrackingStage stage, List<TrackingEvent> events) {}

    /** The tracking service (17TRACK). Calls go over the network: never inside a database transaction. */
    public interface TrackingProvider {
        /** False while the server has no key for the provider. */
        boolean configured();
        /** At most 40 numbers per call. */
        List<Registration> register(List<Parcel> parcels);
        /** At most 40 numbers per call; numbers the provider has nothing about yet are left out. */
        List<Report> fetch(List<Parcel> parcels);
    }
    /** The plan this store paid for; set on the server, not from the panel. */
    public interface TrackingAccount { TrackingPlan plan(); }

    /** A shipment on its way whose number is not followed yet (or whose number was corrected). */
    public record Pending(UUID shipmentId, UUID orderId, String carrier, String number) {}
    /** A followed shipment due for a new look. */
    public record Followed(UUID shipmentId, UUID orderId, String carrier, String number, Integer carrierKey) {}

    public interface TrackingRepository {
        List<Pending> pending(int limit);
        Optional<Pending> pendingFor(UUID orderId);
        /** Numbers started from the given instant on (the start of the month). */
        int registeredSince(Instant from);
        /** Records the number as followed and counts it against the month; drops movements of a previous number. */
        void registered(UUID shipmentId, String number, Integer carrierKey);
        /** The provider refused this number (bad format…): not retried until the team corrects it. */
        void rejected(UUID shipmentId, String number, String error);
        /** Followed shipments still on their way, not looked at for the given time. */
        List<Followed> due(Duration every, int limit);
        Optional<Followed> followed(UUID orderId);
        /** Stores the stage (null keeps the current one) and the movements not seen before; marks it as looked at. */
        void report(UUID shipmentId, TrackingStage stage, List<TrackingEvent> events);
        /** Shipments that are no longer on their way stop being followed. */
        int finishClosed();
    }
}

package dev.nortech.norpress.fulfillment.domain;
import java.time.Instant;

/** One movement the carrier published: when, what and where (location may be empty). */
public record TrackingEvent(Instant at, String description, String location) {
    public TrackingEvent {
        if (at == null) throw new IllegalArgumentException("Un movimiento necesita su fecha");
        description = description == null ? "" : description.trim();
        location = location == null ? "" : location.trim();
        if (description.length() > 500) description = description.substring(0, 500);
        if (location.length() > 200) location = location.substring(0, 200);
    }
}

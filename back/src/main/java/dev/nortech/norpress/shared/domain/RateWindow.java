package dev.nortech.norpress.shared.domain;
import java.time.Duration;
import java.time.Instant;

/**
 * Calls counted in a fixed window. Immutable: {@link #hit} answers the next state, and {@link #exceeds} says whether
 * that state is over the limit, with how long until the window ends.
 */
public record RateWindow(Instant start, int calls) {
    public static final RateWindow EMPTY = new RateWindow(null, 0);

    public RateWindow hit(Instant now, Duration window) {
        return start == null || !now.isBefore(start.plus(window)) ? new RateWindow(now, 1) : new RateWindow(start, calls + 1);
    }
    public boolean exceeds(int limit) { return calls > limit; }
    /** Seconds until the window resets, at least 1. */
    public long retryAfter(Instant now, Duration window) { return start == null ? 1 : Math.max(1, Duration.between(now, start.plus(window)).toSeconds()); }
    public boolean expired(Instant now, Duration window) { return start == null || !now.isBefore(start.plus(window)); }
}

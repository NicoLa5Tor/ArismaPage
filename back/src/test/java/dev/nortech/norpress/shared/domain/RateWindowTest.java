package dev.nortech.norpress.shared.domain;
import org.junit.jupiter.api.Test;
import java.time.Duration;
import java.time.Instant;
import static org.junit.jupiter.api.Assertions.*;

class RateWindowTest {
    private static final Duration WINDOW = Duration.ofMinutes(10);
    private static final Instant T0 = Instant.parse("2026-11-22T12:00:00Z");

    @Test void countsCallsInsideTheWindowAndBlocksPastTheLimit() {
        var state = RateWindow.EMPTY;
        for (int i = 0; i < 3; i++) state = state.hit(T0.plusSeconds(i), WINDOW);
        assertFalse(state.exceeds(3));
        state = state.hit(T0.plusSeconds(10), WINDOW);
        assertTrue(state.exceeds(3));
        assertEquals(590, state.retryAfter(T0.plusSeconds(10), WINDOW));
    }
    @Test void startsOverOnceTheWindowEnds() {
        var state = RateWindow.EMPTY.hit(T0, WINDOW).hit(T0.plusSeconds(1), WINDOW);
        state = state.hit(T0.plus(WINDOW), WINDOW);
        assertEquals(1, state.calls());
        assertEquals(T0.plus(WINDOW), state.start());
    }
    @Test void waitIsNeverZero() {
        var state = RateWindow.EMPTY.hit(T0, WINDOW);
        assertEquals(1, state.retryAfter(T0.plus(WINDOW).minusMillis(1), WINDOW));
        assertTrue(state.expired(T0.plus(WINDOW), WINDOW));
    }
}

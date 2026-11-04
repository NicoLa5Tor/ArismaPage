package co.com.arisma.identity.domain;
import java.time.Duration;
import java.time.Instant;

/** Throttles password guessing: after 5 consecutive failures the account locks for 15 minutes. */
public record LoginGuard(int failedAttempts, Instant lockedUntil) {
    public static final int MAX_FAILURES = 5;
    public static final Duration LOCK = Duration.ofMinutes(15);
    public boolean locked(Instant now) { return lockedUntil != null && now.isBefore(lockedUntil); }
    public long secondsLeft(Instant now) { return locked(now) ? Math.max(1, Duration.between(now, lockedUntil).toSeconds()) : 0; }
    /** State after a wrong password; a lock that already expired starts a fresh count. */
    public LoginGuard afterFailure(Instant now) {
        int attempts = (lockedUntil != null && !locked(now) ? 0 : failedAttempts) + 1;
        return attempts >= MAX_FAILURES ? new LoginGuard(0, now.plus(LOCK)) : new LoginGuard(attempts, null);
    }
    public static LoginGuard clear() { return new LoginGuard(0, null); }
}

package dev.nortech.norpress.shared.domain;

/** Signed in but not allowed to do this (role, locked account, pending password change). Adapters translate it to HTTP 403, or 429 when retryAfterSeconds is set. */
public class Forbidden extends RuntimeException {
    private final long retryAfterSeconds;
    public Forbidden(String message) { this(message, 0); }
    public Forbidden(String message, long retryAfterSeconds) { super(message); this.retryAfterSeconds = retryAfterSeconds; }
    public long retryAfterSeconds() { return retryAfterSeconds; }
}

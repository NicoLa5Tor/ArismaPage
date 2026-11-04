package co.com.arisma.shared.domain;

/** A referenced record does not exist. Adapters translate it to HTTP 404. */
public class NotFound extends RuntimeException {
    public NotFound(String message) { super(message); }
}

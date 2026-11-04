package co.com.arisma.shared.domain;

/** Missing or invalid credentials. Adapters translate it to HTTP 401. */
public class Unauthorized extends RuntimeException {
    public Unauthorized(String message) { super(message); }
}

package dev.nortech.norpress.shared.domain;

/** The change collides with existing data, such as a duplicate code. Adapters translate it to HTTP 409. */
public class Conflict extends RuntimeException {
    public Conflict(String message) { super(message); }
}

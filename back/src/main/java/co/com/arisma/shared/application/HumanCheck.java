package co.com.arisma.shared.application;

/** Tells a person from a bot by the token a challenge widget (Cloudflare Turnstile) gave the browser. */
public interface HumanCheck {
    /** False when no keys are configured: the check is skipped, as on a developer machine. */
    boolean enabled();
    /** Whether the token is valid, unused and was issued for this client address. Never throws. */
    boolean verify(String token, String clientAddress);
}

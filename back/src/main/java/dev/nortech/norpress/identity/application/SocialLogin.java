package dev.nortech.norpress.identity.application;

/**
 * Sign-in with Google or Facebook through the identity provider. `audience` says who is signing in ("admin" for the
 * panel, "shop" for the store): an attempt started for one audience cannot be completed for the other.
 */
public interface SocialLogin {
    String ADMIN = "admin", SHOP = "shop";
    record Start(String state, String url) {}
    /** A person the provider vouches for: the email is verified. The name may be blank. */
    record Verified(String email, String name) {}
    Start start(String provider, String audience);
    Verified verified(String state, String stateCookie, String code, String audience);
    String logoutUrl();
}

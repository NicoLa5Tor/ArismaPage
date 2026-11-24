package dev.nortech.norpress.customers.adapter;
import dev.nortech.norpress.customers.application.ShopperAuthService;
import dev.nortech.norpress.customers.application.ShopperPorts.Shopper;
import dev.nortech.norpress.identity.application.SocialLogin;
import dev.nortech.norpress.shared.domain.Unauthorized;
import dev.nortech.norpress.shared.adapter.Guarded;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.*;
import java.util.Map;
import org.eclipse.microprofile.config.inject.ConfigProperty;

/**
 * Store account session: httpOnly cookie, SameSite=Lax (the shopper comes back from the payment page and from Logto),
 * 30 days from the last visit: reading the session renews it and its cookie. Every write under /api/shop also needs the X-CSRF-Token returned here.
 */
@Path("/api/shop/session") @Produces(MediaType.APPLICATION_JSON) @Consumes(MediaType.APPLICATION_JSON)
public class ShopSessionResource {
    public static final String COOKIE = "norpress_cliente";
    static final String STATE_COOKIE = "norpress_cliente_social";
    @Inject ShopperAuthService auth;
    @Inject SocialLogin social;
    @ConfigProperty(name = "norpress.cookie.secure", defaultValue = "true") boolean secure;
    public record Login(String email, String password) {}
    public record Signup(String name, String email, String password) {}
    public record SocialCallback(String state, String code) {}

    @Guarded(bucket = "shop-login", limit = 20, windowSeconds = 600, human = true)
    @POST public Response login(Login in) { return signedIn(auth.login(in == null ? null : in.email(), in == null ? null : in.password())); }
    @Guarded(bucket = "shop-register", limit = 10, windowSeconds = 3600, human = true)
    @POST @Path("/register") public Response register(Signup in) {
        if (in == null) throw new IllegalArgumentException("Datos de la cuenta requeridos");
        return signedIn(auth.register(in.name(), in.email(), in.password()));
    }
    @GET public Response current(@CookieParam(COOKIE) String token) {
        var issued = auth.restore(token);
        return Response.ok(body(issued)).header("Cache-Control", "no-store").cookie(cookie(COOKIE, issued.token(), (int) ShopperAuthService.TTL.toSeconds())).build();
    }
    @DELETE public Response logout(@CookieParam(COOKIE) String token, @HeaderParam("X-CSRF-Token") String csrf) {
        auth.logout(token, csrf);
        return Response.ok(Map.of("ok", true)).header("Cache-Control", "no-store").cookie(cookie(COOKIE, "", 0)).build();
    }
    public record EmailInput(String email) {}
    public record ResetInput(String token, String password) {}
    public record TokenInput(String token) {}
    @Inject dev.nortech.norpress.customers.application.ShopperAccountService accounts;
    @ConfigProperty(name = "norpress.public-url", defaultValue = "http://localhost:8000") String site;
    /** Always "ok", so nobody can learn from it which emails have an account. */
    @Guarded(bucket = "shop-reset-request", limit = 5, windowSeconds = 3600, human = true)
    @POST @Path("/reset-request") public Map<String, Boolean> resetRequest(EmailInput in) { accounts.requestReset(in == null ? null : in.email(), site.replaceAll("/+$", "")); return Map.of("ok", true); }
    @Guarded(bucket = "shop-reset", limit = 20, windowSeconds = 3600)
    @POST @Path("/reset") public Response reset(ResetInput in) {
        if (in == null) throw new IllegalArgumentException("Enlace inválido");
        accounts.resetPassword(in.token(), in.password());
        return Response.ok(Map.of("ok", true)).header("Cache-Control", "no-store").cookie(cookie(COOKIE, "", 0)).build();
    }
    @Guarded(bucket = "shop-verify", limit = 30, windowSeconds = 3600)
    @POST @Path("/verify") public Map<String, Boolean> verify(TokenInput in) { accounts.confirmEmail(in == null ? null : in.token()); return Map.of("ok", true); }
    @Guarded(bucket = "shop-social", limit = 30, windowSeconds = 600)
    @GET @Path("/social/start") public Response socialStart(@QueryParam("provider") String provider) {
        var start = social.start(provider, SocialLogin.SHOP);
        return Response.ok(Map.of("url", start.url())).header("Cache-Control", "no-store").cookie(cookie(STATE_COOKIE, start.state(), 300)).build();
    }
    @Guarded(bucket = "shop-social", limit = 30, windowSeconds = 600)
    @POST @Path("/social/callback") public Response socialCallback(SocialCallback in, @CookieParam(STATE_COOKIE) String stateCookie) {
        if (in == null) throw new Unauthorized("Inicio de sesión inválido");
        var person = social.verified(in.state(), stateCookie, in.code(), SocialLogin.SHOP);
        var issued = auth.loginVerified(person.email(), person.name());
        return Response.ok(body(issued)).header("Cache-Control", "no-store").cookie(cookie(COOKIE, issued.token(), (int) ShopperAuthService.TTL.toSeconds()), cookie(STATE_COOKIE, "", 0)).build();
    }

    private Response signedIn(ShopperAuthService.Issued issued) {
        return Response.ok(body(issued)).header("Cache-Control", "no-store").cookie(cookie(COOKIE, issued.token(), (int) ShopperAuthService.TTL.toSeconds())).build();
    }
    static Map<String, Object> body(ShopperAuthService.Issued issued) { return Map.of("csrf", issued.csrf(), "shopper", view(issued.shopper())); }
    static Map<String, Object> view(Shopper s) { return Map.of("id", s.accountId(), "name", s.name(), "email", s.email(), "emailVerified", s.emailVerified()); }
    private NewCookie cookie(String name, String value, int maxAge) { return new NewCookie.Builder(name).value(value).path("/").httpOnly(true).secure(secure).sameSite(NewCookie.SameSite.LAX).maxAge(maxAge).build(); }
}

package dev.nortech.norpress.identity.adapter;
import dev.nortech.norpress.identity.application.IdentityPorts.Principal;
import dev.nortech.norpress.identity.application.SessionService;
import dev.nortech.norpress.shared.adapter.Guarded;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.*;
import java.util.*;
import org.eclipse.microprofile.config.inject.ConfigProperty;

/** Cookie session for the panel: httpOnly, SameSite=Strict, 8 hours; every write also needs the X-CSRF-Token returned here. */
@Path("/api/admin/session") @Produces(MediaType.APPLICATION_JSON) @Consumes(MediaType.APPLICATION_JSON)
public class SessionResource {
    static final String COOKIE = "norpress_admin";
    @Inject SessionService sessions;
    @Inject dev.nortech.norpress.identity.application.SocialLogin social;
    @ConfigProperty(name="norpress.cookie.secure", defaultValue="true") boolean secure;
    public record Login(String email, String password) {}

    @Guarded(bucket = "admin-login", limit = 10, windowSeconds = 900, human = true)
    @POST public Response login(Login in) {
        var issued = sessions.login(in == null ? null : in.email(), in == null ? null : in.password());
        return Response.ok(body(issued.csrf(), issued.user())).cookie(cookie(issued.token(), (int) SessionService.TTL.toSeconds())).build();
    }
    public record SocialCallback(String state, String code) {}
    @Guarded(bucket = "admin-social", limit = 30, windowSeconds = 600)
    @GET @Path("/social/start") public Response socialStart(@QueryParam("provider") String provider) {
        var start = social.start(provider, dev.nortech.norpress.identity.application.SocialLogin.ADMIN);
        return Response.ok(Map.of("url", start.url())).header("Cache-Control", "no-store").cookie(socialCookie(start.state(), 300)).build();
    }
    @Guarded(bucket = "admin-social", limit = 30, windowSeconds = 600)
    @POST @Path("/social/callback") public Response socialCallback(SocialCallback input, @CookieParam("norpress_social_state") String stateCookie) {
        if (input == null) throw new dev.nortech.norpress.shared.domain.Unauthorized("Inicio de sesi\u00f3n inv\u00e1lido");
        var issued = sessions.loginVerifiedEmail(social.verified(input.state(), stateCookie, input.code(), dev.nortech.norpress.identity.application.SocialLogin.ADMIN).email());
        return Response.ok(body(issued.csrf(), issued.user())).header("Cache-Control", "no-store").cookie(cookie(issued.token(), (int) SessionService.TTL.toSeconds()), socialCookie("", 0)).build();
    }
    private NewCookie socialCookie(String value, int maxAge) { return new NewCookie.Builder("norpress_social_state").value(value).path("/").httpOnly(true).secure(secure).sameSite(NewCookie.SameSite.LAX).maxAge(maxAge).build(); }
    @GET public Response current(@CookieParam(COOKIE) String token) {
        var issued = sessions.restore(token);
        return Response.ok(body(issued.csrf(), issued.user())).header("Cache-Control","no-store").build();
    }
    @DELETE public Response logout(@CookieParam(COOKIE) String token, @HeaderParam("X-CSRF-Token") String csrf) {
        sessions.logout(token, csrf);
        return Response.ok(Map.of("redirectUrl", social.logoutUrl()))
            .header("Cache-Control", "no-store").cookie(cookie("", 0)).build();
    }
    static Map<String,Object> body(String csrf, Principal u) { return Map.of("csrf", csrf, "user", user(u)); }
    static Map<String,Object> user(Principal u) {
        return Map.of("id", u.userId(), "name", u.name(), "email", u.email(), "role", u.role().db(), "roleLabel", u.role().label(),
            "permissions", u.permissions().stream().map(Enum::name).sorted().toList(), "mustChangePassword", u.mustChangePassword());
    }
    private NewCookie cookie(String value, int maxAge) { return new NewCookie.Builder(COOKIE).value(value).path("/").httpOnly(true).secure(secure).sameSite(NewCookie.SameSite.STRICT).maxAge(maxAge).build(); }
}

package co.com.arisma.identity.adapter;
import co.com.arisma.identity.application.IdentityPorts.Principal;
import co.com.arisma.identity.application.SessionService;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.*;
import java.util.*;
import org.eclipse.microprofile.config.inject.ConfigProperty;

/** Cookie session for the panel: httpOnly, SameSite=Strict, 8 hours; every write also needs the X-CSRF-Token returned here. */
@Path("/api/admin/session") @Produces(MediaType.APPLICATION_JSON) @Consumes(MediaType.APPLICATION_JSON)
public class SessionResource {
    static final String COOKIE = "arisma_admin";
    @Inject SessionService sessions;
    @ConfigProperty(name="arisma.cookie.secure", defaultValue="true") boolean secure;
    public record Login(String email, String password) {}

    @POST public Response login(Login in) {
        var issued = sessions.login(in == null ? null : in.email(), in == null ? null : in.password());
        return Response.ok(body(issued.csrf(), issued.user())).cookie(cookie(issued.token(), (int) SessionService.TTL.toSeconds())).build();
    }
    @GET public Response current(@CookieParam(COOKIE) String token) {
        var issued = sessions.restore(token);
        return Response.ok(body(issued.csrf(), issued.user())).header("Cache-Control","no-store").build();
    }
    @DELETE public Response logout(@CookieParam(COOKIE) String token, @HeaderParam("X-CSRF-Token") String csrf) {
        sessions.logout(token, csrf);
        return Response.noContent().cookie(cookie("", 0)).build();
    }
    static Map<String,Object> body(String csrf, Principal u) { return Map.of("csrf", csrf, "user", user(u)); }
    static Map<String,Object> user(Principal u) {
        return Map.of("id", u.userId(), "name", u.name(), "email", u.email(), "role", u.role().db(), "roleLabel", u.role().label(),
            "permissions", u.permissions().stream().map(Enum::name).sorted().toList(), "mustChangePassword", u.mustChangePassword());
    }
    private NewCookie cookie(String value, int maxAge) { return new NewCookie.Builder(COOKIE).value(value).path("/").httpOnly(true).secure(secure).sameSite(NewCookie.SameSite.STRICT).maxAge(maxAge).build(); }
}

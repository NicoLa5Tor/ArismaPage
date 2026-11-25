package dev.nortech.norpress.customers.adapter;
import dev.nortech.norpress.customers.application.ShopperAccountService;
import dev.nortech.norpress.customers.application.ShopperPorts.Shopper;
import dev.nortech.norpress.shared.adapter.Guarded;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import java.util.Map;
import org.eclipse.microprofile.config.inject.ConfigProperty;

/** The signed-in shopper's own account (ShopFilter checks the session and, on writes, the CSRF token). */
@Path("/api/shop/account") @Produces(MediaType.APPLICATION_JSON) @Consumes(MediaType.APPLICATION_JSON)
public class ShopAccountResource {
    @Inject ShopperAccountService accounts;
    @Context ContainerRequestContext context;
    @ConfigProperty(name = "norpress.public-url", defaultValue = "http://localhost:8000") String site;
    public record NameInput(String name) {}
    public record PasswordInput(String current, String next) {}

    @PUT @Path("/name") public Map<String, Object> rename(NameInput in) { return ShopSessionResource.view(accounts.rename(shopper(), in == null ? null : in.name())); }
    @Guarded(bucket = "shop-password", limit = 10, windowSeconds = 900)
    @PUT @Path("/password") public Map<String, Boolean> password(PasswordInput in, @CookieParam(ShopSessionResource.COOKIE) String token) {
        if (in == null) throw new IllegalArgumentException("Escribe la contraseña nueva");
        accounts.changePassword(shopper(), in.current(), in.next(), token);
        return Map.of("ok", true);
    }
    @POST @Path("/logout-everywhere") public Map<String, Boolean> logoutEverywhere() { accounts.logoutEverywhere(shopper()); return Map.of("ok", true); }
    @Guarded(bucket = "shop-verification", limit = 5, windowSeconds = 3600)
    @POST @Path("/verification") public Map<String, Boolean> verification() { accounts.requestVerification(shopper(), site.replaceAll("/+$", "")); return Map.of("ok", true); }
    /** A copy of everything the store keeps about the shopper (Ley 1581), as a file to download. */
    @Guarded(bucket = "shop-export", limit = 10, windowSeconds = 3600)
    @GET @Path("/export") public jakarta.ws.rs.core.Response export() {
        return jakarta.ws.rs.core.Response.ok(accounts.export(shopper())).header("Content-Disposition", "attachment; filename=\"mis-datos.json\"").header("Cache-Control", "no-store").build();
    }
    /** password, or for an account without one, confirm = "ELIMINAR". */
    public record EraseInput(String password, String confirm) {}
    /** Erases the account; the session cookie goes with it. */
    @Guarded(bucket = "shop-erase", limit = 10, windowSeconds = 900)
    @POST @Path("/erase") public jakarta.ws.rs.core.Response erase(EraseInput in) {
        accounts.erase(shopper(), in == null ? null : in.password(), in == null ? null : in.confirm());
        return jakarta.ws.rs.core.Response.ok(Map.of("ok", true)).header("Cache-Control", "no-store")
            .cookie(new jakarta.ws.rs.core.NewCookie.Builder(ShopSessionResource.COOKIE).value("").path("/").httpOnly(true).secure(secure).sameSite(jakarta.ws.rs.core.NewCookie.SameSite.LAX).maxAge(0).build()).build();
    }
    @ConfigProperty(name = "norpress.cookie.secure", defaultValue = "true") boolean secure;
    private Shopper shopper() { return (Shopper) context.getProperty(ShopFilter.SHOPPER); }
}

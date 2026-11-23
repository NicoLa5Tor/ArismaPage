package co.com.arisma.customers.adapter;
import co.com.arisma.customers.application.ShopperAuthService;
import jakarta.annotation.Priority;
import jakarta.inject.Inject;
import jakarta.ws.rs.Priorities;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerRequestFilter;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.Provider;
import java.util.Map;

/**
 * Everything under /api/shop except the session itself needs a signed-in shopper; writes also need the CSRF token.
 * The shopper is left in the request as "shopper" for the resources.
 */
@Provider @Priority(Priorities.AUTHENTICATION)
public class ShopFilter implements ContainerRequestFilter {
    public static final String SHOPPER = "shopper";
    @Inject ShopperAuthService auth;
    public void filter(ContainerRequestContext request) {
        String path = request.getUriInfo().getPath().replaceFirst("^/+", "");
        if (!path.startsWith("api/shop/") || path.equals("api/shop/session") || path.startsWith("api/shop/session/")) return;
        var cookie = request.getCookies().get(ShopSessionResource.COOKIE);
        boolean write = !request.getMethod().equals("GET") && !request.getMethod().equals("HEAD");
        try {
            var shopper = auth.authenticate(cookie == null ? null : cookie.getValue(), request.getHeaderString("X-CSRF-Token"), write);
            if (shopper.isEmpty()) { request.abortWith(error(401, "Inicia sesión para continuar")); return; }
            request.setProperty(SHOPPER, shopper.get());
        } catch (RuntimeException e) { request.abortWith(error(503, "Servicio no disponible")); }
    }
    private static Response error(int status, String message) { return Response.status(status).type(MediaType.APPLICATION_JSON).entity(Map.of("error", message)).build(); }
}

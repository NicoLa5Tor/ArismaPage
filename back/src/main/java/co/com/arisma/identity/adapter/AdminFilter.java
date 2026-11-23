package co.com.arisma.identity.adapter;
import co.com.arisma.identity.application.SessionService;
import co.com.arisma.shared.adapter.Requires;
import jakarta.annotation.Priority;
import jakarta.inject.Inject;
import jakarta.ws.rs.Priorities;
import jakarta.ws.rs.container.*;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.Provider;
import java.util.Arrays;
import java.util.Map;

/**
 * Every /api/admin call except the session itself needs a valid session; writes also need the CSRF token.
 * Endpoints declare what they need with @Requires; a pending password change only allows reaching /api/admin/me.
 */
@Provider @Priority(Priorities.AUTHENTICATION)
public class AdminFilter implements ContainerRequestFilter {
    @Inject SessionService sessions;
    @Context ResourceInfo resource;
    public void filter(ContainerRequestContext request) {
        String path = request.getUriInfo().getPath().replaceFirst("^/+", "");
        if (!path.startsWith("api/admin/") || (path.equals("api/admin/session") || path.equals("api/admin/session/social/start") || path.equals("api/admin/session/social/callback"))) return;
        var cookie = request.getCookies().get(SessionResource.COOKIE);
        boolean write = !request.getMethod().equals("GET") && !request.getMethod().equals("HEAD");
        try {
            var user = sessions.authenticate(cookie == null ? null : cookie.getValue(), request.getHeaderString("X-CSRF-Token"), write);
            if (user.isEmpty()) { request.abortWith(error(401, "Sesión no válida o vencida")); return; }
            var principal = user.get();
            if (principal.mustChangePassword() && !path.startsWith("api/admin/me")) { request.abortWith(error(403, "Debes cambiar tu contraseña antes de continuar")); return; }
            var required = required();
            if (required != null && !Arrays.stream(required.value()).allMatch(principal::can)) { request.abortWith(error(403, "Tu rol (" + principal.role().label() + ") no permite esta acción")); return; }
            request.setProperty("adminUser", principal.userId());
            request.setProperty("principal", principal);
        } catch (RuntimeException e) { request.abortWith(error(503, "Servicio no disponible")); }
    }
    private Requires required() {
        var method = resource.getResourceMethod();
        if (method == null) return null;
        var onMethod = method.getAnnotation(Requires.class);
        return onMethod != null ? onMethod : resource.getResourceClass().getAnnotation(Requires.class);
    }
    private static Response error(int status, String message) { return Response.status(status).type(MediaType.APPLICATION_JSON).entity(Map.of("error", message)).build(); }
}

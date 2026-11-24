package dev.nortech.norpress.shared.adapter;
import dev.nortech.norpress.shared.domain.Conflict;
import dev.nortech.norpress.shared.domain.Forbidden;
import dev.nortech.norpress.shared.domain.Unauthorized;
import dev.nortech.norpress.shared.domain.NotFound;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;
import java.util.Map;

/** Every API error is JSON {"error": "..."} so the panel can show the reason. Domain exceptions map to HTTP here. */
public final class ErrorMapper {
    private ErrorMapper() {}
    static Response json(int status, String message) { return Response.status(status).type(MediaType.APPLICATION_JSON).entity(Map.of("error",message)).build(); }
    @Provider public static class Web implements ExceptionMapper<WebApplicationException> {
        public Response toResponse(WebApplicationException e) {
            int status=e.getResponse().getStatus();
            String message=e.getMessage()==null || e.getMessage().startsWith("HTTP ") ? switch(status) { case 404 -> "No encontrado"; case 400 -> "Solicitud inválida"; case 405 -> "Método no permitido"; default -> "No se pudo completar la solicitud"; } : e.getMessage();
            return json(status,message);
        }
    }
    @Provider public static class Invalid implements ExceptionMapper<IllegalArgumentException> {
        public Response toResponse(IllegalArgumentException e) { return json(400,e.getMessage()==null?"Solicitud inválida":e.getMessage()); }
    }
    @Provider public static class Missing implements ExceptionMapper<NotFound> {
        public Response toResponse(NotFound e) { return json(404,e.getMessage()); }
    }
    @Provider public static class Duplicate implements ExceptionMapper<Conflict> {
        public Response toResponse(Conflict e) { return json(409,e.getMessage()); }
    }
    @Provider public static class Unauthenticated implements ExceptionMapper<Unauthorized> {
        public Response toResponse(Unauthorized e) { return json(401,e.getMessage()); }
    }
    @Provider public static class Denied implements ExceptionMapper<Forbidden> {
        public Response toResponse(Forbidden e) {
            if(e.retryAfterSeconds()>0) return Response.fromResponse(json(429,e.getMessage())).header("Retry-After",e.retryAfterSeconds()).build();
            return json(403,e.getMessage());
        }
    }
}

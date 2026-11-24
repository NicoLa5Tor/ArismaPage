package dev.nortech.norpress.identity.adapter;
import dev.nortech.norpress.identity.application.AccountService;
import dev.nortech.norpress.identity.application.IdentityPorts.Principal;
import dev.nortech.norpress.identity.application.IdentityPorts.UserRepository;
import dev.nortech.norpress.identity.application.UserService;
import dev.nortech.norpress.identity.domain.Role;
import dev.nortech.norpress.shared.adapter.Requires;
import dev.nortech.norpress.shared.domain.NotFound;
import dev.nortech.norpress.shared.domain.Permission;
import dev.nortech.norpress.shared.adapter.Guarded;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.*;
import java.util.*;

/** Panel users (administrators only) and the signed-in user's own account. */
@Path("/api/admin") @Produces(MediaType.APPLICATION_JSON) @Consumes(MediaType.APPLICATION_JSON)
public class AdminUserResource {
    @Inject UserRepository users;
    @Inject UserService service;
    @Inject AccountService account;
    @Context jakarta.ws.rs.container.ContainerRequestContext context;
    public record NewUser(String email, String name, String role) {}
    public record UserChange(String name, String role, boolean active) {}
    public record PasswordChange(String current, String next) {}

    @GET @Path("/users") @Requires(Permission.USERS_MANAGE) public List<Map<String,Object>> list() { return users.list(); }
    @GET @Path("/users/{id}") @Requires(Permission.USERS_MANAGE) public Map<String,Object> get(@PathParam("id") UUID id) { return users.view(id).orElseThrow(() -> new NotFound("Usuario no encontrado")); }
    @POST @Path("/users") @Requires(Permission.USERS_MANAGE) public Response create(NewUser in) {
        if (in == null) throw new IllegalArgumentException("Datos del usuario requeridos");
        return Response.status(201).entity(service.create(in.email(), in.name(), Role.parse(in.role()), actor())).build();
    }
    @PUT @Path("/users/{id}") @Requires(Permission.USERS_MANAGE) public Map<String,Object> update(@PathParam("id") UUID id, UserChange in) {
        if (in == null) throw new IllegalArgumentException("Datos del usuario requeridos");
        return service.update(id, in.name(), Role.parse(in.role()), in.active(), actor());
    }
    @POST @Path("/users/{id}/password-reset") @Requires(Permission.USERS_MANAGE) public UserService.WithPassword reset(@PathParam("id") UUID id) { return service.resetPassword(id, actor()); }
    @DELETE @Path("/users/{id}/sessions") @Requires(Permission.USERS_MANAGE) public Response closeSessions(@PathParam("id") UUID id) { service.closeSessions(id, actor()); return Response.noContent().build(); }

    /** Any signed-in user, even one who must still change the temporary password. */
    @GET @Path("/me") @Requires({}) public Map<String,Object> me() { return SessionResource.user((Principal) context.getProperty("principal")); }
    @Guarded(bucket = "admin-password", limit = 10, windowSeconds = 900)
    @PUT @Path("/me/password") @Requires({}) public Response changePassword(PasswordChange in, @CookieParam(SessionResource.COOKIE) String token) {
        if (in == null) throw new IllegalArgumentException("Escribe la contraseña actual y la nueva");
        account.changePassword(actor(), in.current(), in.next(), token);
        return Response.noContent().build();
    }
    private UUID actor() { return (UUID) context.getProperty("adminUser"); }
}

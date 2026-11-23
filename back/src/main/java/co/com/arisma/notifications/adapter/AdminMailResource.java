package co.com.arisma.notifications.adapter;
import co.com.arisma.notifications.application.NotificationService;
import co.com.arisma.shared.adapter.Requires;
import co.com.arisma.shared.domain.Permission;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import java.util.List;
import java.util.Map;

/** The store's outbox: every email it wrote, with its delivery state. It holds one-time links, so it needs the settings permission to read. */
@Path("/api/admin/mail") @Produces(MediaType.APPLICATION_JSON) @Consumes(MediaType.APPLICATION_JSON) @Requires(Permission.SETTINGS_MANAGE)
public class AdminMailResource {
    @Inject NotificationService notifications;
    public record TestInput(String to) {}
    public record OutboxPage(List<Map<String, Object>> items, long total) {}

    @GET @Path("/outbox") public OutboxPage outbox(@QueryParam("limit") @DefaultValue("30") int limit, @QueryParam("offset") @DefaultValue("0") int offset) {
        return new OutboxPage(notifications.latest(limit, offset), notifications.count());
    }
    @POST @Path("/test") public Map<String, String> test(TestInput in) { return Map.of("result", notifications.sendTest(in == null ? null : in.to())); }
}

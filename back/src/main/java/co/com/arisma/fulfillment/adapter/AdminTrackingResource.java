package co.com.arisma.fulfillment.adapter;
import co.com.arisma.fulfillment.application.TrackingService;
import co.com.arisma.shared.adapter.Requires;
import co.com.arisma.shared.domain.Permission;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import java.util.UUID;

/** Automatic tracking: the administrator's switch, the plan and this month's use. */
@Path("/api/admin/tracking") @Produces(MediaType.APPLICATION_JSON) @Consumes(MediaType.APPLICATION_JSON)
public class AdminTrackingResource {
    @Inject TrackingService tracking;
    @Context ContainerRequestContext context;

    /** ready: the server has the provider's key. limit and used count shipments of the current month. */
    public record View(boolean enabled, boolean ready, String plan, String planLabel, int limit, int used, int remaining, String month) {
        static View of(TrackingService.Status s) {
            return new View(s.enabled(), s.ready(), s.plan().db(), s.plan().label, s.quota().limit(), s.quota().used(), s.quota().remaining(), s.month());
        }
    }
    public record Input(Boolean enabled) {}

    @GET public View get() { return View.of(tracking.status()); }
    @Requires(Permission.SETTINGS_MANAGE) @PUT public View save(Input in) {
        if (in == null || in.enabled() == null) throw new IllegalArgumentException("Indica si el seguimiento queda activo");
        return View.of(tracking.enable(in.enabled(), (UUID) context.getProperty("adminUser")));
    }
}

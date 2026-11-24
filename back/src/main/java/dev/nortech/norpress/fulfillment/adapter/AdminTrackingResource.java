package dev.nortech.norpress.fulfillment.adapter;
import dev.nortech.norpress.fulfillment.application.TrackingService;
import dev.nortech.norpress.shared.adapter.Requires;
import dev.nortech.norpress.shared.domain.Permission;
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

    /**
     * ready: there is a key (the store's or the server's). limit and used count this month's shipments of the store's
     * plan; account is the 17TRACK account as its API reports it now (null with accountError when it did not answer).
     */
    public record View(boolean enabled, boolean ready, String plan, String planLabel, int limit, int used, int remaining, String month,
                       String keySource, dev.nortech.norpress.fulfillment.application.TrackingPorts.ProviderAccount account, String accountError,
                       String webhookUrl, boolean webhookReachable) {}

    /** The store's public address: 17TRACK posts its updates to the webhook under it. */
    @org.eclipse.microprofile.config.inject.ConfigProperty(name = "norpress.public-url", defaultValue = "http://localhost:8000") String site;
    static final String WEBHOOK_PATH = "/api/seguimiento/17track";

    View of(TrackingService.Status s) {
        String webhook = site.replaceAll("/+$", "") + WEBHOOK_PATH;
        return new View(s.enabled(), s.ready(), s.plan().db(), s.plan().label, s.quota().limit(), s.quota().used(), s.quota().remaining(), s.month(),
            s.keySource(), s.account(), s.accountError(), webhook, reachable(webhook));
    }
    /** 17TRACK can only reach an https address on the internet, never this machine. */
    static boolean reachable(String url) {
        try {
            var uri = java.net.URI.create(url);
            String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase();
            return "https".equals(uri.getScheme()) && !host.isEmpty() && !host.equals("localhost") && !host.endsWith(".localhost")
                && !host.startsWith("127.") && !host.startsWith("10.") && !host.startsWith("192.168.") && !host.equals("[::1]");
        } catch (IllegalArgumentException e) { return false; }
    }
    public record Input(Boolean enabled) {}
    public record KeyInput(String key) {}

    @GET public View get() { return of(tracking.status()); }
    @Requires(Permission.SETTINGS_MANAGE) @PUT public View save(Input in) {
        if (in == null || in.enabled() == null) throw new IllegalArgumentException("Indica si el seguimiento queda activo");
        return of(tracking.enable(in.enabled(), (UUID) context.getProperty("adminUser")));
    }
    /** Saves the store's 17TRACK key once 17TRACK accepts it. It is never sent back. */
    @Requires(Permission.SETTINGS_MANAGE) @PUT @Path("/key") public View saveKey(KeyInput in) {
        return of(tracking.saveKey(in == null ? null : in.key(), (UUID) context.getProperty("adminUser")));
    }
    @Requires(Permission.SETTINGS_MANAGE) @DELETE @Path("/key") public View removeKey() {
        return of(tracking.removeKey((UUID) context.getProperty("adminUser")));
    }
}

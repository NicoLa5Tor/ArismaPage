package dev.nortech.norpress.fulfillment.adapter;
import dev.nortech.norpress.fulfillment.application.ShipmentFeed;
import io.smallrye.mutiny.Multi;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import org.jboss.resteasy.reactive.RestStreamElementType;
import java.time.Duration;
import java.util.Map;

/**
 * Live changes for the panel (Server-Sent Events): the open screens reload the order that changed instead of
 * polling. A heartbeat every 25 seconds keeps proxies from closing the connection. AdminFilter checks the session.
 */
@Path("/api/admin/events")
public class AdminEventsResource {
    static final Duration HEARTBEAT = Duration.ofSeconds(25);
    @Inject ShipmentFeed feed;

    @GET @Produces(MediaType.SERVER_SENT_EVENTS) @RestStreamElementType(MediaType.APPLICATION_JSON)
    public Multi<Map<String, Object>> events() {
        Multi<Map<String, Object>> changes = feed.changes().map(c -> Map.<String, Object>of("orderId", c.orderId().toString(), "kind", c.kind()));
        Multi<Map<String, Object>> beats = Multi.createFrom().ticks().every(HEARTBEAT).map(t -> Map.<String, Object>of("kind", "heartbeat"));
        return Multi.createBy().merging().streams(changes, beats);
    }
}

package co.com.arisma.fulfillment.adapter;
import co.com.arisma.fulfillment.application.FulfillmentPorts.FulfillmentQueries;
import co.com.arisma.fulfillment.application.FulfillmentService;
import co.com.arisma.fulfillment.domain.DeliveryMethod;
import co.com.arisma.fulfillment.domain.FulfillmentStatus;
import co.com.arisma.shared.adapter.Requires;
import co.com.arisma.shared.domain.Permission;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.*;
import java.util.*;

/** Dispatch board and bulk delivery changes. Each order's delivery lives in AdminShipmentResource. */
@Path("/api/admin/fulfillment") @Produces(MediaType.APPLICATION_JSON) @Consumes(MediaType.APPLICATION_JSON)
public class AdminFulfillmentResource {
    @Inject FulfillmentQueries queries;
    @Inject FulfillmentService service;
    @Context jakarta.ws.rs.container.ContainerRequestContext context;
    public record BulkMove(List<UUID> orderIds, String status, String note) {}
    public record CloseStale(int days) {}

    @GET @Path("/board") public Map<String,Object> board(@QueryParam("method") String method, @QueryParam("q") @DefaultValue("") String q, @QueryParam("staleDays") @DefaultValue("60") int staleDays) {
        return queries.board(DeliveryMethod.parse(method), q, Math.max(30, staleDays));
    }
    @GET @Path("/couriers") public List<Map<String,Object>> couriers() { return queries.couriers(); }
    @Requires(Permission.FULFILLMENT_MANAGE) @POST @Path("/status") public FulfillmentService.BulkResult bulk(BulkMove in) {
        if (in == null) throw new IllegalArgumentException("Selecciona pedidos y el estado de entrega");
        return service.moveAll(in.orderIds(), FulfillmentStatus.parse(in.status()), in.note(), actor());
    }
    @Requires(Permission.FULFILLMENT_MANAGE) @POST @Path("/close-stale") public FulfillmentService.BulkResult closeStale(CloseStale in) { return service.closeStale(in == null ? 0 : in.days(), actor()); }
    private UUID actor() { return (UUID) context.getProperty("adminUser"); }
}

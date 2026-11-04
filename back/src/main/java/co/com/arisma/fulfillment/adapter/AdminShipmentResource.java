package co.com.arisma.fulfillment.adapter;
import co.com.arisma.fulfillment.application.FulfillmentPorts.FulfillmentQueries;
import co.com.arisma.fulfillment.application.FulfillmentService;
import co.com.arisma.fulfillment.domain.DeliveryMethod;
import co.com.arisma.fulfillment.domain.FulfillmentStatus;
import co.com.arisma.fulfillment.domain.Shipment;
import co.com.arisma.shared.adapter.Requires;
import co.com.arisma.shared.domain.NotFound;
import co.com.arisma.shared.domain.Permission;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.*;
import java.util.*;

/** One order's delivery. Its own root path so it does not compete with the orders resource. Every change answers with the updated delivery. */
@Path("/api/admin/orders/{orderId}/shipment") @Produces(MediaType.APPLICATION_JSON) @Consumes(MediaType.APPLICATION_JSON)
public class AdminShipmentResource {
    @Inject FulfillmentQueries queries;
    @Inject FulfillmentService service;
    @Context jakarta.ws.rs.container.ContainerRequestContext context;
    public record Move(String status, String carrier, String trackingCode, UUID courierUserId, String courierName, String recipientName, String reason, String note) {
        Shipment.Details details() { return new Shipment.Details(carrier, trackingCode, courierUserId, courierName, recipientName, reason); }
    }
    public record Reroute(String method, String carrier, String trackingCode, UUID courierUserId, String courierName) {}

    @GET public Map<String,Object> get(@PathParam("orderId") UUID id) { return queries.shipment(id).orElseThrow(() -> new NotFound("Este pedido aún no tiene envío registrado")); }
    @Requires(Permission.FULFILLMENT_MANAGE) @POST @Path("/status") public Map<String,Object> move(@PathParam("orderId") UUID id, Move in) {
        if (in == null) throw new IllegalArgumentException("Indica el nuevo estado de entrega");
        service.move(id, FulfillmentStatus.parse(in.status()), in.details(), in.note(), actor());
        return get(id);
    }
    @Requires(Permission.FULFILLMENT_MANAGE) @PUT public Map<String,Object> reroute(@PathParam("orderId") UUID id, Reroute in) {
        if (in == null) throw new IllegalArgumentException("Indica el método de entrega");
        service.reroute(id, DeliveryMethod.parse(in.method()), new Shipment.Details(in.carrier(), in.trackingCode(), in.courierUserId(), in.courierName(), null, null), actor());
        return get(id);
    }
    private UUID actor() { return (UUID) context.getProperty("adminUser"); }
}

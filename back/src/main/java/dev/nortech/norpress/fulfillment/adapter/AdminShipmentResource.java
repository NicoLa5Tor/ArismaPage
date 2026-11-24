package dev.nortech.norpress.fulfillment.adapter;
import dev.nortech.norpress.fulfillment.application.FulfillmentPorts.FulfillmentQueries;
import dev.nortech.norpress.fulfillment.application.FulfillmentService;
import dev.nortech.norpress.fulfillment.domain.DeliveryMethod;
import dev.nortech.norpress.fulfillment.domain.FulfillmentStatus;
import dev.nortech.norpress.fulfillment.domain.Shipment;
import dev.nortech.norpress.shared.adapter.Requires;
import dev.nortech.norpress.shared.domain.NotFound;
import dev.nortech.norpress.shared.domain.Permission;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.*;
import java.util.*;

/** One order's delivery. Its own root path so it does not compete with the orders resource. Every change answers with the updated delivery. */
@Path("/api/admin/orders/{orderId}/shipment") @Produces(MediaType.APPLICATION_JSON) @Consumes(MediaType.APPLICATION_JSON)
public class AdminShipmentResource {
    @Inject FulfillmentQueries queries;
    @Inject FulfillmentService service;
    @Inject dev.nortech.norpress.fulfillment.application.TrackingService tracking;
    @Context jakarta.ws.rs.container.ContainerRequestContext context;
    /** carrierCode: one of the store's carriers (null: carrier typed by hand); follow: follow the guide automatically (default) or give only the link. */
    public record Move(String status, String carrier, String trackingCode, UUID courierUserId, String courierName, String recipientName, String reason, String note, String carrierCode, Boolean follow) {
        Shipment.Details details() { return new Shipment.Details(carrier, trackingCode, courierUserId, courierName, recipientName, reason); }
        FulfillmentService.Dispatch dispatch() { return new FulfillmentService.Dispatch(carrierCode, follow == null || follow); }
    }
    public record Reroute(String method, String carrier, String trackingCode, UUID courierUserId, String courierName) {}

    @GET public Map<String,Object> get(@PathParam("orderId") UUID id) { return queries.shipment(id).orElseThrow(() -> new NotFound("Este pedido aún no tiene envío registrado")); }
    @Requires(Permission.FULFILLMENT_MANAGE) @POST @Path("/status") public Map<String,Object> move(@PathParam("orderId") UUID id, Move in) {
        if (in == null) throw new IllegalArgumentException("Indica el nuevo estado de entrega");
        service.move(id, FulfillmentStatus.parse(in.status()), in.details(), in.dispatch(), in.note(), actor());
        return get(id);
    }
    @Requires(Permission.FULFILLMENT_MANAGE) @PUT public Map<String,Object> reroute(@PathParam("orderId") UUID id, Reroute in) {
        if (in == null) throw new IllegalArgumentException("Indica el método de entrega");
        service.reroute(id, DeliveryMethod.parse(in.method()), new Shipment.Details(in.carrier(), in.trackingCode(), in.courierUserId(), in.courierName(), null, null), actor());
        return get(id);
    }
    /** Asks the carrier now instead of waiting for the next round; starts following the guide if it was not yet. */
    @Requires(Permission.FULFILLMENT_MANAGE) @POST @Path("/tracking") public Map<String,Object> track(@PathParam("orderId") UUID id) {
        tracking.refresh(id);
        return get(id);
    }
    private UUID actor() { return (UUID) context.getProperty("adminUser"); }
}

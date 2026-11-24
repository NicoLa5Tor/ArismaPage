package dev.nortech.norpress.fulfillment.adapter;
import dev.nortech.norpress.fulfillment.application.TrackingService;
import dev.nortech.norpress.shared.adapter.Guarded;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

/**
 * 17TRACK tells the store when a followed guide changes (its webhook), so the order and the shopper's page update at
 * once instead of waiting for the next round. Public, but only a push signed with the account key is believed.
 */
@Path("/api/public/tracking/17track")
public class TrackingWebhookResource {
    @Inject SeventeenTrack provider;
    @Inject TrackingService tracking;

    @Guarded(bucket = "tracking-webhook", limit = 600, windowSeconds = 60)
    @POST @Consumes(MediaType.WILDCARD) @Produces(MediaType.TEXT_PLAIN)
    public Response push(String body, @HeaderParam("sign") String sign) {
        if (!provider.signed(body, sign)) return Response.status(401).entity("firma inválida").build();
        SeventeenTrack.pushed(body).ifPresent(tracking::onPush);
        return Response.ok("ok").build();
    }
}

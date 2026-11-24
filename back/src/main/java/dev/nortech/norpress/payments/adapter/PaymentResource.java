package dev.nortech.norpress.payments.adapter;
import dev.nortech.norpress.payments.application.PaymentService;
import dev.nortech.norpress.sales.application.StorefrontOrders.Access;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.MultivaluedMap;
import jakarta.ws.rs.core.Response;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import org.eclipse.microprofile.config.inject.ConfigProperty;

/**
 * Following and paying an order with the key the shopper received (no account needed), and the gateways'
 * notifications. The gateways prove themselves with their signatures. Orders of a signed-in shopper: ShopOrdersResource.
 */
@Path("/api/public") @Produces(MediaType.APPLICATION_JSON)
public class PaymentResource {
    @Inject PaymentService payments;
    @Inject dev.nortech.norpress.sales.application.StorefrontOrders orders;
    @Inject dev.nortech.norpress.fulfillment.application.ShipmentFeed feed;
    /** The store's own address, used for return and confirmation links. Never taken from the request. */
    @ConfigProperty(name = "norpress.public-url", defaultValue = "http://localhost:8000") String site;
    public record KeyInput(String number, String key) {}
    public record ReturnInput(String number, String key, Map<String, String> params) {}

    @GET @Path("/orders/{number}") public Response order(@PathParam("number") String number, @QueryParam("clave") String key) {
        return Response.ok(payments.view(access(number, key))).header("Cache-Control", "no-store").build();
    }
    @GET @Path("/orders/{number}/events") @Produces(MediaType.SERVER_SENT_EVENTS) @org.jboss.resteasy.reactive.RestStreamElementType(MediaType.APPLICATION_JSON)
    public io.smallrye.mutiny.Multi<Map<String, Object>> events(@PathParam("number") String number, @QueryParam("clave") String key) {
        var order = orders.payable(access(number, key)).orElseThrow(() -> new dev.nortech.norpress.shared.domain.NotFound("Pedido no encontrado"));
        return live(feed, order.id());
    }

    /**
     * Live changes of this order for its page (Server-Sent Events): only "it changed", the page asks again for the order
     * with the same access. A heartbeat every 25 seconds keeps the connection open through proxies.
     */
    static io.smallrye.mutiny.Multi<java.util.Map<String, Object>> live(dev.nortech.norpress.fulfillment.application.ShipmentFeed feed, java.util.UUID orderId) {
        io.smallrye.mutiny.Multi<java.util.Map<String, Object>> changes = feed.changes().filter(c -> c.orderId().equals(orderId)).map(c -> java.util.Map.<String, Object>of("kind", c.kind()));
        io.smallrye.mutiny.Multi<java.util.Map<String, Object>> beats = io.smallrye.mutiny.Multi.createFrom().ticks().every(java.time.Duration.ofSeconds(25)).map(t -> java.util.Map.<String, Object>of("kind", "heartbeat"));
        return io.smallrye.mutiny.Multi.createBy().merging().streams(changes, beats);
    }

    @POST @Path("/payments/start") @Consumes(MediaType.APPLICATION_JSON) public PaymentService.Instruction start(KeyInput in) {
        if (in == null) throw new IllegalArgumentException("Pedido requerido");
        String base = site.replaceAll("/+$", "");
        return payments.start(access(in.number(), in.key()), base + "/pedido/" + enc(in.number()) + "?clave=" + enc(in.key()), base);
    }
    @POST @Path("/payments/return") @Consumes(MediaType.APPLICATION_JSON) public PaymentService.Outcome back(ReturnInput in) {
        if (in == null) throw new IllegalArgumentException("Pedido requerido");
        return payments.confirmReturn(access(in.number(), in.key()), in.params());
    }

    @POST @Path("/payments/wompi/webhook") @Consumes(MediaType.WILDCARD) public Response wompi(String body, @HeaderParam("X-Event-Checksum") String checksum) {
        payments.wompiEvent(body, checksum);
        return Response.ok(Map.of("ok", true)).build();
    }
    @POST @Path("/payments/payu/webhook") @Consumes(MediaType.APPLICATION_FORM_URLENCODED) @Produces(MediaType.TEXT_PLAIN) public Response payu(MultivaluedMap<String, String> form) {
        var fields = new HashMap<String, String>();
        if (form != null) form.forEach((name, values) -> { if (values != null && !values.isEmpty()) fields.put(name, values.get(0)); });
        payments.payuConfirmation(fields);
        return Response.ok("OK").build();
    }
    private Access access(String number, String key) {
        if (key == null || key.isBlank()) throw new dev.nortech.norpress.shared.domain.NotFound("Pedido no encontrado");
        return Access.byKey(number, payments.digest(key));
    }
    static String enc(String value) { return URLEncoder.encode(value == null ? "" : value, StandardCharsets.UTF_8); }
}

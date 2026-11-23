package co.com.arisma.payments.adapter;
import co.com.arisma.payments.application.PaymentService;
import co.com.arisma.sales.application.StorefrontOrders.Access;
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
    /** The store's own address, used for return and confirmation links. Never taken from the request. */
    @ConfigProperty(name = "arisma.public-url", defaultValue = "http://localhost:8000") String site;
    public record KeyInput(String number, String key) {}
    public record ReturnInput(String number, String key, Map<String, String> params) {}

    @GET @Path("/orders/{number}") public Response order(@PathParam("number") String number, @QueryParam("clave") String key) {
        return Response.ok(payments.view(access(number, key))).header("Cache-Control", "no-store").build();
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
        if (key == null || key.isBlank()) throw new co.com.arisma.shared.domain.NotFound("Pedido no encontrado");
        return Access.byKey(number, payments.digest(key));
    }
    static String enc(String value) { return URLEncoder.encode(value == null ? "" : value, StandardCharsets.UTF_8); }
}

package co.com.arisma.payments.adapter;
import co.com.arisma.customers.application.ShopperPorts.Shopper;
import co.com.arisma.payments.application.PaymentService;
import co.com.arisma.sales.application.StorefrontOrders;
import co.com.arisma.sales.application.StorefrontOrders.Access;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import java.util.List;
import java.util.Map;
import org.eclipse.microprofile.config.inject.ConfigProperty;

/**
 * "Mis pedidos": a signed-in shopper sees and pays their orders without the key. A verified email also reaches the
 * orders its customer made before (in the old store or as a guest); an unverified one only those of the account.
 */
@Path("/api/shop/orders") @Produces(MediaType.APPLICATION_JSON) @Consumes(MediaType.APPLICATION_JSON)
public class ShopOrdersResource {
    @Inject StorefrontOrders orders;
    @Inject PaymentService payments;
    @Context ContainerRequestContext context;
    @ConfigProperty(name = "arisma.public-url", defaultValue = "http://localhost:8000") String site;
    public record ReturnInput(Map<String, String> params) {}

    @GET public List<Map<String, Object>> list(@QueryParam("limit") @DefaultValue("20") int limit, @QueryParam("offset") @DefaultValue("0") int offset) {
        var s = shopper();
        return orders.owned(s.accountId(), s.emailVerified() ? s.customerId() : null, limit, offset);
    }
    @GET @Path("/{number}") public Map<String, Object> order(@PathParam("number") String number) { return payments.view(access(number)); }
    @POST @Path("/{number}/pay") public PaymentService.Instruction pay(@PathParam("number") String number) {
        String base = site.replaceAll("/+$", "");
        return payments.start(access(number), base + "/cuenta/pedidos/" + PaymentResource.enc(number), base);
    }
    @POST @Path("/{number}/return") public PaymentService.Outcome back(@PathParam("number") String number, ReturnInput in) {
        return payments.confirmReturn(access(number), in == null ? Map.of() : in.params());
    }
    private Shopper shopper() { return (Shopper) context.getProperty("shopper"); }
    private Access access(String number) { var s = shopper(); return Access.byAccount(number, s.accountId(), s.emailVerified() ? s.customerId() : null); }
}

package co.com.arisma.payments.adapter;
import co.com.arisma.payments.application.PaymentService;
import co.com.arisma.shared.adapter.Requires;
import co.com.arisma.shared.domain.Permission;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import java.util.Map;
import java.util.UUID;

/** Payments the team registers by hand from the order dialog. */
@Path("/api/admin/orders/{orderId}/payment") @Produces(MediaType.APPLICATION_JSON) @Consumes(MediaType.APPLICATION_JSON)
public class AdminPaymentResource {
    @Inject PaymentService payments;
    @Context ContainerRequestContext context;
    public record Input(String reference) {}
    /** Opening the order in the panel asks the gateway about a payment that may have arrived without notice. Reading only: open to every panel user. */
    @Requires({}) @POST @Path("/check") public Map<String, String> check(@PathParam("orderId") UUID orderId) {
        var state = payments.reconcile(orderId);
        return Map.of("status", state == null ? "" : state.db());
    }
    @Requires(Permission.ORDERS_MANAGE) @POST public Map<String, Boolean> register(@PathParam("orderId") UUID orderId, Input in) {
        payments.registerManual(orderId, in == null ? null : in.reference(), (UUID) context.getProperty("adminUser"));
        return Map.of("ok", true);
    }
}

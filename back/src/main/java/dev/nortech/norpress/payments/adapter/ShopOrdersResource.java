package dev.nortech.norpress.payments.adapter;
import dev.nortech.norpress.customers.application.ShopperPorts.Shopper;
import dev.nortech.norpress.payments.application.PaymentService;
import dev.nortech.norpress.sales.application.StorefrontOrders;
import dev.nortech.norpress.sales.application.StorefrontOrders.Access;
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
    @Inject dev.nortech.norpress.fulfillment.application.ShipmentFeed feed;
    @Context ContainerRequestContext context;
    @ConfigProperty(name = "norpress.public-url", defaultValue = "http://localhost:8000") String site;
    public record ReturnInput(Map<String, String> params) {}

    @GET public List<Map<String, Object>> list(@QueryParam("limit") @DefaultValue("20") int limit, @QueryParam("offset") @DefaultValue("0") int offset) {
        var s = shopper();
        return orders.owned(s.accountId(), s.emailVerified() ? s.customerId() : null, limit, offset);
    }
    /** Orders with a step the shopper has not seen: the notices of their account. */
    @GET @Path("/news") public List<Map<String, Object>> news() {
        var s = shopper();
        return orders.news(s.accountId(), s.emailVerified() ? s.customerId() : null);
    }
    /** Live notices of the account: "something changed in one of your orders"; the page asks for the news again. */
    @GET @Path("/news/events") @Produces(MediaType.SERVER_SENT_EVENTS) @org.jboss.resteasy.reactive.RestStreamElementType(MediaType.APPLICATION_JSON)
    public io.smallrye.mutiny.Multi<Map<String, Object>> newsEvents() {
        var s = shopper();
        var mine = orders.ownedIds(s.accountId(), s.emailVerified() ? s.customerId() : null);
        io.smallrye.mutiny.Multi<Map<String, Object>> changes = feed.changes().filter(c -> mine.contains(c.orderId())).map(c -> Map.<String, Object>of("kind", c.kind()));
        io.smallrye.mutiny.Multi<Map<String, Object>> beats = io.smallrye.mutiny.Multi.createFrom().ticks().every(java.time.Duration.ofSeconds(25)).map(t -> Map.<String, Object>of("kind", "heartbeat"));
        return io.smallrye.mutiny.Multi.createBy().merging().streams(changes, beats);
    }
    /** The shopper opened the order: its steps so far are no longer news. */
    /** The account a refund is transferred to, as the shopper types it. */
    public record AccountInput(String bank, String accountType, String number, String holder, String documentType, String document) {
        dev.nortech.norpress.sales.domain.Payout payout() { return new dev.nortech.norpress.sales.domain.Payout(bank, accountType, number, holder, documentType, document); }
    }
    public record CancelInput(String reason, AccountInput account) {}
    @jakarta.inject.Inject dev.nortech.norpress.sales.application.AfterSaleService afterSale;
    /** What cancelling would do: whether it can be cancelled, how much comes back and how, and if an account is needed. */
    @GET @Path("/{number}/cancel") public dev.nortech.norpress.sales.application.AfterSaleService.Preview cancelPreview(@PathParam("number") String number) { return afterSale.preview(access(number)); }
    /** The shopper cancels the order while it has not left; a paid one is refunded right away. */
    @dev.nortech.norpress.shared.adapter.Guarded(bucket = "shop-cancel", limit = 20, windowSeconds = 3600)
    @POST @Path("/{number}/cancel") public Map<String, Object> cancel(@PathParam("number") String number, CancelInput in) {
        if (in == null) throw new IllegalArgumentException("Cuéntanos por qué quieres cancelar el pedido");
        afterSale.cancelByShopper(access(number), in.reason(), in.account() == null ? null : in.account().payout());
        return payments.view(access(number));
    }
    /** The account for a refund waiting for a transfer (when the gateway could not give it back). */
    @dev.nortech.norpress.shared.adapter.Guarded(bucket = "shop-refund-account", limit = 10, windowSeconds = 3600)
    @POST @Path("/{number}/refund-account") public Map<String, Object> refundAccount(@PathParam("number") String number, AccountInput in) {
        if (in == null) throw new IllegalArgumentException("Escribe los datos de tu cuenta");
        afterSale.giveAccount(access(number), in.payout());
        return payments.view(access(number));
    }
    @POST @Path("/{number}/seen") public void seen(@PathParam("number") String number) { orders.markSeen(access(number)); }
    @GET @Path("/{number}") public Map<String, Object> order(@PathParam("number") String number) { return payments.view(access(number)); }
    @GET @Path("/{number}/events") @Produces(MediaType.SERVER_SENT_EVENTS) @org.jboss.resteasy.reactive.RestStreamElementType(MediaType.APPLICATION_JSON)
    public io.smallrye.mutiny.Multi<Map<String, Object>> events(@PathParam("number") String number) {
        var order = orders.payable(access(number)).orElseThrow(() -> new dev.nortech.norpress.shared.domain.NotFound("Pedido no encontrado"));
        return PaymentResource.live(feed, order.id());
    }
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

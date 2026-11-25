package dev.nortech.norpress.checkout.adapter;
import dev.nortech.norpress.checkout.application.CheckoutService;
import dev.nortech.norpress.checkout.domain.Buyer;
import dev.nortech.norpress.checkout.domain.CartPricing;
import dev.nortech.norpress.customers.application.ShopperAuthService;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

/**
 * Checkout. Prices and shipping can be asked by anyone (the cart shows them); placing an order needs a store account,
 * whose session cookie names the buyer. The address is one of the buyer's saved addresses, and their data (name,
 * phone, document) is saved to their profile for next time.
 */
@Path("/api/public/checkout") @Produces(MediaType.APPLICATION_JSON) @Consumes(MediaType.APPLICATION_JSON)
public class CheckoutResource {
    @Inject CheckoutService checkout;
    @Inject ShopperAuthService shoppers;
    @org.eclipse.microprofile.config.inject.ConfigProperty(name = "norpress.public-url", defaultValue = "http://localhost:8000") String site;
    public record LineInput(UUID productId, int quantity) {}
    /** delivery: "local", "national", "pickup" or empty when not chosen yet. coupon and email are optional. */
    public record QuoteInput(List<LineInput> lines, String delivery, String coupon, String email) {}
    public record ContactInput(String firstName, String lastName, String phone, String documentType, String documentNumber, String company) {}
    /** An order from a signed-in buyer: a saved address (or pickup) and their contact data. */
    public record AccountOrderInput(List<LineInput> lines, ContactInput contact, boolean pickup, UUID addressId, String note, String coupon, boolean acceptsTerms) {}
    @Inject dev.nortech.norpress.customers.application.ShopperAddressService addresses;
    @Inject dev.nortech.norpress.settings.application.LegalService legal;
    /** What a buyer accepts when placing an order: every document the store has published, in its latest version. */
    static final List<String> ACCEPTED = dev.nortech.norpress.settings.domain.LegalPages.KINDS;

    @GET @Path("/options") public Response options() { return Response.ok(checkout.options()).header("Cache-Control", "no-store").build(); }

    @POST @Path("/quote") public CheckoutService.Quote quote(QuoteInput in) {
        if (in == null) throw new IllegalArgumentException("Tu carrito está vacío");
        return checkout.quote(lines(in.lines()), delivery(in.delivery()), in.coupon(), in.email());
    }

    /** The order and the proof of what the buyer accepted are written together: one never exists without the other. */
    @POST @Path("/orders") @jakarta.transaction.Transactional
    public Response place(AccountOrderInput in, @CookieParam("norpress_cliente") String token, @HeaderParam("X-Forwarded-For") String forwarded, @HeaderParam("User-Agent") String agent,
                          @jakarta.ws.rs.core.Context io.vertx.core.http.HttpServerRequest connection) {
        // the order needs an account; the cookie names the buyer (no CSRF token: placing an order changes nothing of the account)
        var shopper = shoppers.authenticate(token, null, false).orElseThrow(() -> new dev.nortech.norpress.shared.domain.Unauthorized("Inicia sesión para comprar"));
        if (in == null || in.contact() == null) throw new IllegalArgumentException("Faltan tus datos");
        if (!in.acceptsTerms()) throw new IllegalArgumentException("Acepta los términos y las políticas de la tienda para continuar");
        var c = in.contact();
        var profile = addresses.saveProfile(shopper, new dev.nortech.norpress.customers.domain.Profile(c.firstName(), c.lastName(), c.phone(), c.documentType(), c.documentNumber(), c.company()));
        Buyer buyer; Buyer.Destination to = null;
        if (in.pickup()) buyer = new Buyer(profile.firstName(), profile.lastName(), shopper.email(), profile.phone(), profile.documentType(), profile.documentNumber(), profile.company(), true, "", "", "", "", in.note());
        else {
            var a = addresses.address(shopper, in.addressId());
            buyer = new Buyer(profile.firstName(), profile.lastName(), shopper.email(), profile.phone(), profile.documentType(), profile.documentNumber(), profile.company(), false, a.street(), a.detail(), a.city(), a.state(), in.note());
            to = new Buyer.Destination(a.firstName(), a.lastName(), a.phone(), a.neighborhood(), a.instructions(), a.label().db());
        }
        var placed = checkout.place(lines(in.lines()), buyer, to, in.coupon(), java.util.Optional.of(shopper), site.replaceAll("/+$", ""));
        legal.accept(ACCEPTED, "checkout", placed.number(), shopper.accountId(), dev.nortech.norpress.shared.adapter.ClientAddress.of(connection, forwarded), agent);
        return Response.status(201).entity(placed).header("Cache-Control", "no-store").build();
    }

    private static List<CartPricing.Requested> lines(List<LineInput> in) {
        if (in == null) return List.of();
        return in.stream().filter(java.util.Objects::nonNull).map(l -> new CartPricing.Requested(l.productId(), l.quantity())).toList();
    }
    private static CartPricing.Delivery delivery(String value) {
        if (value == null || value.isBlank()) return null;
        if (value.trim().equalsIgnoreCase("bogota")) return CartPricing.Delivery.LOCAL; // fronts written before the local area
        try { return CartPricing.Delivery.valueOf(value.trim().toUpperCase(Locale.ROOT)); } catch (IllegalArgumentException e) { throw new IllegalArgumentException("Forma de entrega inválida"); }
    }
}

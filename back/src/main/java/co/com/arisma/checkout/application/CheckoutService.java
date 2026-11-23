package co.com.arisma.checkout.application;
import co.com.arisma.catalog.application.SellableProducts;
import co.com.arisma.catalog.domain.PageSections;
import co.com.arisma.checkout.domain.Buyer;
import co.com.arisma.checkout.domain.CartPricing;
import co.com.arisma.checkout.domain.CartPricing.Delivery;
import co.com.arisma.customers.application.CustomerDirectory;
import co.com.arisma.customers.application.ShopperPorts.Shopper;
import co.com.arisma.identity.application.IdentityPorts.Secrets;
import co.com.arisma.notifications.application.NotificationService;
import co.com.arisma.notifications.domain.Templates;
import co.com.arisma.promotions.application.CouponRedemption;
import co.com.arisma.promotions.domain.Redemption;
import co.com.arisma.sales.application.OrderPlacement;
import co.com.arisma.settings.application.StoreSettingsService;
import co.com.arisma.settings.domain.Shipping;
import co.com.arisma.shared.domain.Conflict;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Duration;
import java.util.*;

/**
 * From a cart to an order. The browser only says which products, how many and which coupon; prices, tax, discounts,
 * delivery and availability are worked out here, and again when the order is placed, so a stale cart never buys at an
 * old price. Shoppers pay with the one method the store has active.
 */
@ApplicationScoped
public class CheckoutService {
    /** What the checkout page needs to draw itself. payment is null when the store has no method ready. */
    public record Options(Map<String, Object> shipping, Method payment) {}
    public record Method(String code, String label, boolean test) {}
    /** A priced cart. couponError explains why the code given does not apply (the cart is then priced without it). */
    public record Quote(CartPricing cart, String couponError, boolean freeShippingCoupon, @com.fasterxml.jackson.annotation.JsonIgnore UUID couponId) {}
    /** number and key are what the shopper keeps to follow and pay the order. */
    public record Placed(String number, String key, BigDecimal total, boolean test) {}

    @Inject SellableProducts catalog;
    @Inject StoreSettingsService settings;
    @Inject CouponRedemption coupons;
    @Inject CustomerDirectory customers;
    @Inject OrderPlacement placement;
    @Inject Secrets secrets;
    @Inject NotificationService notifications;
    Clock clock = Clock.systemUTC();

    public Options options() {
        var test = settings.payments().test();
        var payment = settings.activeGateway().map(g -> new Method(g.code().db(), g.code().label, test && g.code().hasEnvironments())).orElse(null);
        return new Options(settings.shipping().toMap(), payment);
    }

    /** email lets the per-customer limit of a coupon be checked; it may be null on the cart page. */
    public Quote quote(List<CartPricing.Requested> lines, Delivery delivery, String couponCode, String email) {
        var ids = lines == null ? List.<UUID>of() : lines.stream().filter(Objects::nonNull).map(CartPricing.Requested::productId).filter(Objects::nonNull).distinct().limit(CartPricing.MAX_LINES + 1L).toList();
        boolean storeSellsOnline = settings.pageSections().of(PageSections.Section.BUY) != PageSections.Visibility.HIDE;
        var items = new HashMap<UUID, CartPricing.Item>();
        catalog.find(ids).forEach((id, s) -> {
            boolean buy = s.buyChoice() == PageSections.Visibility.INHERIT ? storeSellsOnline : s.buyChoice() == PageSections.Visibility.SHOW;
            items.put(id, new CartPricing.Item(id, s.slug(), s.title(), s.sku(), s.netPrice(), s.onSale(), s.taxPercent(), s.availability().maxQuantity(), buy && s.netPrice() != null, s.imageId(), s.imageUrl(), s.imageUploaded()));
        });
        var rules = settings.shipping();
        var cart = CartPricing.price(lines, items, rules.minimumOrder());

        String couponError = null; boolean freeShipping = false; UUID couponId = null;
        if (couponCode != null && !couponCode.isBlank()) {
            var counting = cart.lines().stream().filter(CartPricing.Line::counts).map(l -> new Redemption.CartLine(l.productId(), l.quantity(), l.total(), l.taxPercent(), l.onSale())).toList();
            try {
                var applied = coupons.apply(couponCode, counting, email);
                cart = cart.withDiscount(applied.code(), applied.byLine());
                freeShipping = applied.freeShipping(); couponId = applied.couponId();
            } catch (IllegalArgumentException e) { couponError = e.getMessage(); }
        }
        if (delivery != null) {
            BigDecimal cost = delivery == Delivery.PICKUP || freeShipping ? BigDecimal.ZERO : rules.cost(Shipping.Method.valueOf(delivery.name()), cart.payableGoods());
            cart = cart.withShipping(delivery, cost);
        }
        return new Quote(cart, couponError, freeShipping, couponId);
    }

    @Transactional
    /** site is the store's own address, for the link in the confirmation email. */
    public Placed place(List<CartPricing.Requested> lines, Buyer buyer, String couponCode, Optional<Shopper> shopper, String site) {
        return place(lines, buyer, null, couponCode, shopper, site);
    }

    /** `to`: who receives it and the delivery details of the saved address (null for pickup or older fronts). */
    @Transactional
    public Placed place(List<CartPricing.Requested> lines, Buyer buyer, Buyer.Destination to, String couponCode, Optional<Shopper> shopper, String site) {
        if (buyer == null) throw new IllegalArgumentException("Faltan tus datos");
        var gateway = settings.activeGateway().orElseThrow(() -> new Conflict("La tienda no está recibiendo pagos en este momento. Escríbenos por WhatsApp y te ayudamos a completar la compra."));
        boolean test = settings.payments().test() && gateway.code().hasEnvironments();
        var store = settings.profile();
        var delivery = buyer.pickup() ? Delivery.PICKUP : store.isLocal(buyer.city(), buyer.state()) ? Delivery.LOCAL : Delivery.NATIONAL;
        var quote = quote(lines, delivery, couponCode, buyer.email());
        if (quote.couponError() != null) throw new IllegalArgumentException("Cupón: " + quote.couponError());
        var cart = quote.cart();
        String problem = cart.firstProblem();
        if (problem != null) throw new Conflict(problem);

        UUID customerId = shopper.filter(s -> s.email().equalsIgnoreCase(buyer.email())).map(Shopper::customerId)
            .orElseGet(() -> customers.ensure(buyer.email(), buyer.firstName(), buyer.lastName(), buyer.phone(), buyer.documentType(), buyer.documentNumber(), buyer.company()));
        var orderLines = cart.lines().stream().filter(CartPricing.Line::counts)
            .map(l -> new OrderPlacement.NewLine(l.productId(), l.sku(), l.title(), l.quantity(), l.unitNet(), l.subtotalNet(), l.discountNet(), l.tax(), l.taxPercent())).toList();
        var discount = cart.coupon() == null ? null : new OrderPlacement.NewDiscount(quote.couponId(), cart.coupon(), cart.discountNet(), cart.discount().subtract(cart.discountNet()));
        String shippingMethod = delivery == Delivery.PICKUP ? "local_pickup" : cart.shipping().signum() == 0 ? "free_shipping" : "flat_rate";
        String shippingLabel = delivery == Delivery.PICKUP ? "Recoger en tienda " + store.name() + (store.localCity().isEmpty() ? "" : ", " + store.localCity())
            : cart.shipping().signum() == 0 ? "Envío gratuito" : delivery == Delivery.LOCAL ? (store.localCity().isEmpty() ? "Envío local" : "Envío en " + store.localCity()) : "Envío nacional";
        String key = secrets.token();
        var placed = placement.place(new OrderPlacement.NewOrder(customerId, shopper.map(Shopper::accountId).orElse(null), buyer.billing(), buyer.shipping(to), buyer.note(), orderLines, discount,
            shippingMethod, shippingLabel, cart.shipping(), cart.subtotalNet(), cart.discountNet(), cart.tax(), cart.total(), gateway.code().db(), gateway.code().label, test, secrets.digest(key),
            clock.instant().plus(Duration.ofHours(settings.checkout().unpaidHours()))));
        var emailLines = cart.lines().stream().filter(CartPricing.Line::counts).map(l -> new Templates.Line(l.title(), l.quantity(), l.total())).toList();
        notifications.orderPlaced(buyer.email(), buyer.fullName(), placed.number(), emailLines, cart.discount(), cart.shipping(), cart.total(), gateway.code().label,
            site + "/pedido/" + java.net.URLEncoder.encode(placed.number(), java.nio.charset.StandardCharsets.UTF_8) + "?clave=" + java.net.URLEncoder.encode(key, java.nio.charset.StandardCharsets.UTF_8), test);
        return new Placed(placed.number(), key, cart.total(), test);
    }
}

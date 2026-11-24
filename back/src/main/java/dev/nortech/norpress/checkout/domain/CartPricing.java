package dev.nortech.norpress.checkout.domain;
import dev.nortech.norpress.shared.domain.Pricing;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;

/**
 * A cart priced by the store, never by the browser. It is built in steps: the products (price), an optional coupon
 * (withDiscount) and the delivery (withShipping). Shoppers see whole pesos with tax included; the order keeps
 * tax-exclusive amounts like the imported history: a line's net is what it charges divided by (1 + rate), tax the rest.
 * `problem` on a line says why it cannot be bought as asked; `blockers` are about the whole cart.
 */
public record CartPricing(List<Line> lines, BigDecimal goods, BigDecimal discount, String coupon, BigDecimal subtotalNet, BigDecimal discountNet, BigDecimal tax,
                          Delivery delivery, BigDecimal shipping, BigDecimal total, BigDecimal minimumOrder, List<String> blockers) {
    public static final int MAX_LINES = 40;
    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

    public enum Delivery { LOCAL, NATIONAL, PICKUP }
    public record Requested(UUID productId, int quantity) {}
    /** What the catalog says about a product right now. netPrice is the price in force, null when it has no public price. */
    public record Item(UUID productId, String slug, String title, String sku, BigDecimal netPrice, boolean onSale, BigDecimal taxPercent, int maxQuantity, boolean buyable,
                       UUID imageId, String imageUrl, boolean imageUploaded) {}
    /**
     * total is what the line charges before a coupon (tax included) and discount what the coupon takes from it.
     * subtotalNet, discountNet and tax are the tax-exclusive split of the order after the coupon.
     */
    public record Line(UUID productId, String slug, String title, String sku, int quantity, int maxQuantity, boolean onSale, BigDecimal unitPrice, BigDecimal taxPercent,
                       BigDecimal total, BigDecimal discount, BigDecimal subtotalNet, BigDecimal discountNet, BigDecimal tax, UUID imageId, String imageUrl, boolean imageUploaded, String problem) {
        public boolean counts() { return problem == null && unitPrice != null; }
        public BigDecimal unitNet() { return quantity == 0 ? BigDecimal.ZERO : subtotalNet.divide(BigDecimal.valueOf(quantity), 2, RoundingMode.HALF_UP); }
        public BigDecimal netAfterDiscount() { return subtotalNet.subtract(discountNet); }
    }

    public static CartPricing price(List<Requested> requested, Map<UUID, Item> catalog, BigDecimal minimumOrder) {
        if (requested == null || requested.isEmpty()) throw new IllegalArgumentException("Tu carrito está vacío");
        if (requested.size() > MAX_LINES) throw new IllegalArgumentException("El carrito admite máximo " + MAX_LINES + " productos distintos");
        var wanted = new LinkedHashMap<UUID, Integer>();
        for (var r : requested) {
            if (r == null || r.productId() == null || r.quantity() < 1 || r.quantity() > 999) throw new IllegalArgumentException("Revisa las cantidades del carrito");
            wanted.merge(r.productId(), r.quantity(), Integer::sum);
        }
        var lines = new ArrayList<Line>();
        for (var entry : wanted.entrySet()) {
            Item item = catalog.get(entry.getKey());
            int quantity = entry.getValue();
            if (item == null) { lines.add(new Line(entry.getKey(), "", "Producto no disponible", null, quantity, 0, false, null, null, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, null, null, false, "Este producto ya no está en la tienda")); continue; }
            String problem = null;
            if (!item.buyable() || item.netPrice() == null) problem = "Este producto se cotiza por WhatsApp, no se compra por la página";
            else if (item.maxQuantity() <= 0) problem = "Agotado por ahora";
            else if (quantity > item.maxQuantity()) problem = item.maxQuantity() == 1 ? "Solo se puede llevar una unidad" : "Solo hay " + item.maxQuantity() + " unidades";
            BigDecimal unit = item.netPrice() == null ? null : Pricing.withTax(item.netPrice(), percent(item.taxPercent()));
            BigDecimal total = unit == null ? BigDecimal.ZERO : unit.multiply(BigDecimal.valueOf(quantity));
            lines.add(split(new Line(item.productId(), item.slug(), item.title(), item.sku(), quantity, item.maxQuantity(), item.onSale(), unit, item.taxPercent(), total, BigDecimal.ZERO,
                BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, item.imageId(), item.imageUrl(), item.imageUploaded(), problem)));
        }
        return build(lines, null, null, null, minimumOrder);
    }

    /** Applies a coupon: `byLine` is what it takes from each line, tax included. Lines that do not count get nothing. */
    public CartPricing withDiscount(String code, Map<UUID, BigDecimal> byLine) {
        if (code == null || byLine == null) return build(lines.stream().map(l -> split(withLineDiscount(l, BigDecimal.ZERO))).toList(), null, delivery, null, minimumOrder);
        var next = lines.stream().map(l -> split(withLineDiscount(l, l.counts() ? byLine.getOrDefault(l.productId(), BigDecimal.ZERO) : BigDecimal.ZERO))).toList();
        return build(next, code, delivery, shipping, minimumOrder);
    }
    /** Sets the delivery and what it costs (decided by the store's rules for the goods after the coupon). */
    public CartPricing withShipping(Delivery chosen, BigDecimal cost) { return build(lines, coupon, chosen, chosen == null ? null : cost, minimumOrder); }

    /** What the shopper pays for the products, after the coupon: the value delivery rules look at. */
    public BigDecimal payableGoods() { return goods.subtract(discount); }

    /** The first reason this cart cannot become an order as it is, or null when it can. */
    public String firstProblem() {
        for (var line : lines) if (line.problem() != null) return line.title() + ": " + line.problem();
        if (!blockers.isEmpty()) return blockers.get(0);
        if (lines.isEmpty() || goods.signum() <= 0) return "Tu carrito está vacío";
        return null;
    }

    private static Line withLineDiscount(Line l, BigDecimal discount) {
        BigDecimal d = discount.max(BigDecimal.ZERO).min(l.total()).setScale(0, RoundingMode.HALF_UP);
        return new Line(l.productId(), l.slug(), l.title(), l.sku(), l.quantity(), l.maxQuantity(), l.onSale(), l.unitPrice(), l.taxPercent(), l.total(), d,
            l.subtotalNet(), l.discountNet(), l.tax(), l.imageId(), l.imageUrl(), l.imageUploaded(), l.problem());
    }
    /** Tax-exclusive split of a line before and after its discount; tax is what the charged amount carries. */
    private static Line split(Line l) {
        BigDecimal rate = BigDecimal.ONE.add(percent(l.taxPercent()).divide(HUNDRED, 6, RoundingMode.HALF_UP));
        BigDecimal before = l.total().divide(rate, 2, RoundingMode.HALF_UP);
        BigDecimal charged = l.total().subtract(l.discount());
        BigDecimal after = charged.divide(rate, 2, RoundingMode.HALF_UP);
        return new Line(l.productId(), l.slug(), l.title(), l.sku(), l.quantity(), l.maxQuantity(), l.onSale(), l.unitPrice(), l.taxPercent(), l.total(), l.discount(),
            before, before.subtract(after), charged.subtract(after), l.imageId(), l.imageUrl(), l.imageUploaded(), l.problem());
    }
    private static CartPricing build(List<Line> lines, String coupon, Delivery delivery, BigDecimal shipping, BigDecimal minimumOrder) {
        BigDecimal goods = BigDecimal.ZERO, discount = BigDecimal.ZERO, net = BigDecimal.ZERO, discountNet = BigDecimal.ZERO, tax = BigDecimal.ZERO;
        for (var l : lines) if (l.counts()) { goods = goods.add(l.total()); discount = discount.add(l.discount()); net = net.add(l.subtotalNet()); discountNet = discountNet.add(l.discountNet()); tax = tax.add(l.tax()); }
        BigDecimal minimum = minimumOrder == null ? BigDecimal.ZERO : minimumOrder;
        var blockers = new ArrayList<String>();
        if (goods.signum() > 0 && goods.subtract(discount).compareTo(minimum) < 0)
            blockers.add("La compra mínima por la página es de $" + String.format(Locale.forLanguageTag("es-CO"), "%,d", minimum.longValue()));
        BigDecimal total = goods.subtract(discount).add(shipping == null ? BigDecimal.ZERO : shipping);
        return new CartPricing(List.copyOf(lines), goods, discount, coupon, net, discountNet, tax, delivery, shipping, total, minimum, List.copyOf(blockers));
    }
    private static BigDecimal percent(BigDecimal value) { return value == null ? BigDecimal.ZERO : value; }
}

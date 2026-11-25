package dev.nortech.norpress.sales.application;
import dev.nortech.norpress.inventory.application.StockLedger;
import dev.nortech.norpress.sales.domain.OrderStatus;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;

/**
 * Creates an order from the public store. It starts pending payment and already holds its units: each line takes its
 * stock when the order is written, and a cancellation or an expired payment gives it back through the usual status change.
 */
@ApplicationScoped
public class OrderPlacement {
    /** Amounts are tax-exclusive, as in the imported orders. subtotal is the line before its coupon share (discount), tax what the line carries after it. */
    public record NewLine(UUID productId, String sku, String title, int quantity, BigDecimal unitNet, BigDecimal subtotal, BigDecimal discount, BigDecimal tax, BigDecimal taxPercent) {
        public BigDecimal total() { return subtotal.subtract(discount); }
    }
    /** A coupon used by the order: its tax-exclusive amount and the tax that amount no longer carries. */
    public record NewDiscount(UUID couponId, String code, BigDecimal amount, BigDecimal tax) {}
    /** test: placed while payments were in test mode; it follows the whole journey but never counts as a sale. */
    public record NewOrder(UUID customerId, UUID accountId, Map<String, String> billing, Map<String, String> shipping, String note, List<NewLine> lines, NewDiscount discount,
                           String shippingMethod, String shippingLabel, BigDecimal shippingCost, BigDecimal subtotal, BigDecimal discountTotal, BigDecimal tax, BigDecimal total,
                           String paymentMethod, String paymentTitle, boolean test, String publicTokenHash, Instant expiresAt, String requestKey) {}
    public record Placed(UUID id, String number) {}
    /** An order an account already placed with the same request key: number, total and whether it was a test. */
    public record Existing(UUID id, String number, BigDecimal total, boolean test) {}
    /** Write port for new orders. Runs inside the caller's transaction. */
    public interface Writer {
        String nextNumber();
        void insert(UUID id, String number, NewOrder order);
        void insertLine(UUID lineId, UUID orderId, NewLine line, int stockReduced);
        void insertShipping(UUID orderId, String method, String label, BigDecimal cost);
        void insertDiscount(UUID orderId, NewDiscount discount);
        /** Pending store orders whose time to pay ran out. */
        List<UUID> expired(Instant now, int limit);
        /** The order this account placed with this request key, if any. */
        Optional<Existing> byRequest(UUID accountId, String requestKey);
    }
    @Inject Writer writer;
    @Inject StockLedger stock;
    @Inject OrderRepository orders;
    @Inject OrderService service;

    @Transactional
    public Placed place(NewOrder order) {
        UUID id = UUID.randomUUID();
        String number = writer.nextNumber();
        writer.insert(id, number, order);
        for (var line : order.lines()) {
            UUID lineId = UUID.randomUUID();
            // the line exists before the stock movement that points to it
            writer.insertLine(lineId, id, line, 0);
            // an order made in test mode never takes real units: paid in the sandbox, it would keep them forever
            if (order.test()) continue;
            int taken = stock.takeForSale(line.productId(), line.quantity(), lineId, "Venta en la tienda, pedido #" + number);
            if (taken > 0) orders.markReduced(lineId, taken);
        }
        writer.insertShipping(id, order.shippingMethod(), order.shippingLabel(), order.shippingCost());
        if (order.discount() != null) writer.insertDiscount(id, order.discount());
        orders.recordHistory(id, null, OrderStatus.PENDING, null, order.test() ? "Pedido de prueba creado en la tienda (modo de pruebas de pagos)" : "Pedido creado en la tienda");
        return new Placed(id, number);
    }

    /** The order this account already placed with this request key (the same try sent twice). */
    public Optional<Existing> placedBefore(UUID accountId, String requestKey) {
        return accountId == null || requestKey == null || requestKey.isBlank() ? Optional.empty() : writer.byRequest(accountId, requestKey);
    }

    /**
     * Cancels pending store orders past their time to pay, so their units return to the shelf, and tells each buyer.
     * `waiting`: orders whose payment the gateway is still processing (a PSE or Nequi payment not confirmed yet); they
     * keep their units until the gateway answers. Each order in its own transaction.
     */
    public int cancelExpired(Instant now, java.util.Set<UUID> waiting) {
        int cancelled = 0;
        for (UUID id : writer.expired(now, 100)) {
            if (waiting.contains(id)) continue;
            try {
                if (!service.expireUnpaid(id)) continue;
                cancelled++;
                storefront.payable(id).filter(o -> !o.email().isBlank()).ifPresent(o -> notifications.orderExpired(o.email(), o.buyerName(), o.number(), link(o.number())));
            } catch (RuntimeException ignored) { /* paid or changed meanwhile: leave it */ }
        }
        return cancelled;
    }
    @Inject StorefrontOrders storefront;
    @Inject dev.nortech.norpress.notifications.application.NotificationService notifications;
    @org.eclipse.microprofile.config.inject.ConfigProperty(name = "norpress.public-url", defaultValue = "http://localhost:8000") String site;
    private String link(String number) { return site.replaceAll("/+$", "") + "/cuenta/pedidos/" + java.net.URLEncoder.encode(number, java.nio.charset.StandardCharsets.UTF_8); }
}

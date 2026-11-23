package co.com.arisma.sales.application;
import co.com.arisma.inventory.application.StockLedger;
import co.com.arisma.sales.domain.OrderStatus;
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
                           String paymentMethod, String paymentTitle, boolean test, String publicTokenHash, Instant expiresAt) {}
    public record Placed(UUID id, String number) {}
    /** Write port for new orders. Runs inside the caller's transaction. */
    public interface Writer {
        String nextNumber();
        void insert(UUID id, String number, NewOrder order);
        void insertLine(UUID lineId, UUID orderId, NewLine line, int stockReduced);
        void insertShipping(UUID orderId, String method, String label, BigDecimal cost);
        void insertDiscount(UUID orderId, NewDiscount discount);
        /** Pending store orders whose time to pay ran out. */
        List<UUID> expired(Instant now, int limit);
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
            int taken = stock.takeForSale(line.productId(), line.quantity(), lineId, "Venta en la tienda, pedido #" + number);
            if (taken > 0) orders.markReduced(lineId, taken);
        }
        writer.insertShipping(id, order.shippingMethod(), order.shippingLabel(), order.shippingCost());
        if (order.discount() != null) writer.insertDiscount(id, order.discount());
        orders.recordHistory(id, null, OrderStatus.PENDING, null, order.test() ? "Pedido de prueba creado en la tienda (modo de pruebas de pagos)" : "Pedido creado en la tienda");
        return new Placed(id, number);
    }

    /** Cancels pending store orders past their time to pay, so their units return to the shelf. Each one in its own transaction. */
    public int cancelExpired(Instant now) {
        int cancelled = 0;
        for (UUID id : writer.expired(now, 100)) {
            try { service.changeStatusAlone(id, OrderStatus.CANCELLED, "Venció el plazo para pagar", null); cancelled++; }
            catch (RuntimeException ignored) { /* paid or changed meanwhile: leave it */ }
        }
        return cancelled;
    }
}

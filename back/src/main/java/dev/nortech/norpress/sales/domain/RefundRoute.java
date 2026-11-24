package dev.nortech.norpress.sales.domain;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.Set;

/**
 * How money goes back to the shopper. Through the gateway that charged when it can (Wompi refunds any approved
 * transaction it made; PayU refunds cards for 357 days, from 100 pesos, one partial per order, not PSE), otherwise by
 * transfer to the account the shopper gives. A gateway that refuses sends the refund to transfer as well.
 */
public enum RefundRoute {
    WOMPI("a tu medio de pago, por Wompi"), PAYU("a tu medio de pago, por PayU"), TRANSFER("por transferencia a tu cuenta");
    public final String label;
    RefundRoute(String label) { this.label = label; }
    public String db() { return name().toLowerCase(Locale.ROOT); }

    static final Duration PAYU_WINDOW = Duration.ofDays(357), PAYU_SETTLING = Duration.ofMinutes(10);
    static final BigDecimal PAYU_MINIMUM = new BigDecimal("100");
    static final Set<String> PAYU_WITHOUT_REFUNDS = Set.of("PSE", "EFECTY", "BALOTO", "OTHERS_CASH", "BANK_REFERENCED", "SPEI");

    /**
     * The approved payment the refund goes back through. gateway: wompi, payu or manual; paymentType as the gateway
     * names it (CARD, NEQUI, PSE, VISA…); transactionId: the gateway's id of the charge; reference: the store's own
     * reference of that payment try (PayU finds its order by it).
     */
    public record Charge(String gateway, String paymentType, String transactionId, String reference, boolean sandbox, Instant paidAt) {}

    /**
     * charge: null when the order was not paid through a gateway (transfer, cash, a WooCommerce order). ready: the store
     * has the credentials the gateway asks for refunds. earlierGatewayRefund: some of this order was already refunded
     * through the gateway (PayU takes one partial refund per order).
     */
    public static RefundRoute choose(Charge charge, boolean ready, BigDecimal amount, boolean whole, boolean earlierGatewayRefund, Instant now) {
        if (charge == null || !ready || charge.transactionId() == null || charge.transactionId().isBlank()) return TRANSFER;
        return switch (charge.gateway()) {
            case "wompi" -> WOMPI;
            case "payu" -> {
                String type = charge.paymentType() == null ? "" : charge.paymentType().trim().toUpperCase(Locale.ROOT);
                boolean inTime = charge.paidAt() != null && charge.paidAt().plus(PAYU_WINDOW).isAfter(now);
                boolean allowed = inTime && amount.compareTo(PAYU_MINIMUM) >= 0 && !PAYU_WITHOUT_REFUNDS.contains(type) && (whole || !earlierGatewayRefund);
                yield allowed ? PAYU : TRANSFER;
            }
            default -> TRANSFER;
        };
    }
    /** PayU takes a refund only 10 minutes after the charge: before that the refund waits. */
    public static boolean readyToSend(RefundRoute route, Charge charge, Instant now) {
        return route != PAYU || charge == null || charge.paidAt() == null || !charge.paidAt().plus(PAYU_SETTLING).isAfter(now);
    }
}

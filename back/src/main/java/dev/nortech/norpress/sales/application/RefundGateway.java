package dev.nortech.norpress.sales.application;
import dev.nortech.norpress.sales.domain.RefundRoute;
import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;

/**
 * Giving money back through the gateway that charged it (the payments module implements it). Calls go over the
 * network: never inside a database transaction.
 */
public interface RefundGateway {
    /**
     * What the gateway said. APPROVED: the money is on its way back. PENDING: the gateway is reviewing it (PayU), ask
     * again later with `gatewayReference`. DECLINED: it will not do it (the reason in `message`): transfer it instead.
     * UNKNOWN: no answer (timeout, network): it may or may not have happened, so it is never sent again blindly.
     */
    enum Outcome { APPROVED, PENDING, DECLINED, UNKNOWN }
    record Result(Outcome outcome, String gatewayReference, String message) {
        public static Result unknown(String message) { return new Result(Outcome.UNKNOWN, "", message == null ? "La pasarela no respondió" : message); }
    }

    /** The approved charge of the order at a gateway; empty when it was not paid through one. */
    Optional<RefundRoute.Charge> charge(UUID orderId);
    /** The store has the credentials that gateway asks to refund (in the environment of the charge). */
    boolean ready(RefundRoute.Charge charge);
    /** Asks the gateway to give `amount` back; `whole` when it is everything that was paid. */
    Result refund(RefundRoute.Charge charge, BigDecimal amount, boolean whole, String reason);
    /** Asks again about a refund the gateway left pending. */
    Result check(RefundRoute.Charge charge, String gatewayReference);
}

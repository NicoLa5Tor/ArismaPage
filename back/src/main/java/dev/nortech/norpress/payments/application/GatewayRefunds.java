package dev.nortech.norpress.payments.application;
import dev.nortech.norpress.payments.application.PaymentPorts.*;
import dev.nortech.norpress.sales.application.RefundGateway;
import dev.nortech.norpress.sales.domain.RefundRoute;
import dev.nortech.norpress.settings.application.StoreSettingsService;
import dev.nortech.norpress.settings.domain.Gateway;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Optional;
import java.util.UUID;

/**
 * Refunds through the gateway that charged: Wompi (any approved transaction, POST /v1/refunds) or PayU
 * (SUBMIT_TRANSACTION REFUND / PARTIAL_REFUND). Always with the keys of the environment the order was paid in.
 */
@ApplicationScoped
public class GatewayRefunds implements RefundGateway {
    @Inject AttemptRepository attempts;
    @Inject StoreSettingsService settings;
    @Inject WompiApi wompi;
    @Inject PayuApi payu;

    public Optional<RefundRoute.Charge> charge(UUID orderId) {
        return attempts.approved(orderId).filter(a -> a.gateway().equals("wompi") || a.gateway().equals("payu"))
            .map(a -> new RefundRoute.Charge(a.gateway(), a.paymentType(), a.externalId(), a.reference(), a.sandbox(), a.at()));
    }
    public boolean ready(RefundRoute.Charge charge) {
        return switch (charge.gateway()) {
            case "wompi" -> present(secret(Gateway.Code.WOMPI, charge, "privateKey"));
            case "payu" -> present(secret(Gateway.Code.PAYU, charge, "apiKey")) && present(secret(Gateway.Code.PAYU, charge, "apiLogin"));
            default -> false;
        };
    }
    public Result refund(RefundRoute.Charge charge, BigDecimal amount, boolean whole, String reason) {
        if (!ready(charge)) return new Result(Outcome.DECLINED, "", "La tienda no tiene las credenciales de la pasarela para reembolsar");
        return switch (charge.gateway()) {
            case "wompi" -> map(wompi.refund(charge.sandbox(), secret(Gateway.Code.WOMPI, charge, "privateKey"), charge.transactionId(), cents(amount), reason));
            case "payu" -> {
                String login = secret(Gateway.Code.PAYU, charge, "apiLogin"), key = secret(Gateway.Code.PAYU, charge, "apiKey");
                var order = payu.orderId(charge.sandbox(), login, key, charge.reference()).orElse(null);
                // without PayU's order nothing was sent: it is safe to give it back by transfer
                if (order == null) yield new Result(Outcome.DECLINED, "", "PayU no encontró la orden del pago");
                yield map(payu.refund(charge.sandbox(), login, key, order, charge.transactionId(), amount, whole, reason));
            }
            default -> new Result(Outcome.DECLINED, "", "El pago no se hizo por una pasarela");
        };
    }
    public Result check(RefundRoute.Charge charge, String gatewayReference) {
        if (!ready(charge) || gatewayReference == null || gatewayReference.isBlank()) return Result.unknown("Sin consulta posible");
        return switch (charge.gateway()) {
            case "wompi" -> map(wompi.refundState(charge.sandbox(), secret(Gateway.Code.WOMPI, charge, "privateKey"), gatewayReference));
            case "payu" -> gatewayReference.matches("\\d{1,20}")
                ? map(payu.refundState(charge.sandbox(), secret(Gateway.Code.PAYU, charge, "apiLogin"), secret(Gateway.Code.PAYU, charge, "apiKey"), gatewayReference))
                : Result.unknown("Sin consulta posible");
            default -> Result.unknown("Sin consulta posible");
        };
    }

    private static Result map(RefundReply reply) {
        Outcome outcome;
        try { outcome = Outcome.valueOf(reply.outcome()); } catch (RuntimeException e) { outcome = Outcome.UNKNOWN; }
        return new Result(outcome, reply.id() == null ? "" : reply.id(), reply.message() == null ? "" : reply.message());
    }
    private String secret(Gateway.Code code, RefundRoute.Charge charge, String name) { return settings.credentials(code, charge.sandbox()).secrets().get(name); }
    private static boolean present(String value) { return value != null && !value.isBlank(); }
    private static long cents(BigDecimal amount) { return amount.setScale(0, RoundingMode.HALF_UP).longValueExact() * 100; }
}

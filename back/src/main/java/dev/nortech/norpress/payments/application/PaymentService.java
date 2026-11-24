package dev.nortech.norpress.payments.application;
import dev.nortech.norpress.identity.application.IdentityPorts.Secrets;
import dev.nortech.norpress.payments.application.PaymentPorts.*;
import dev.nortech.norpress.payments.domain.PaymentState;
import dev.nortech.norpress.payments.domain.Signatures;
import dev.nortech.norpress.sales.application.OrderService;
import dev.nortech.norpress.sales.application.StorefrontOrders;
import dev.nortech.norpress.sales.application.StorefrontOrders.Payable;
import dev.nortech.norpress.sales.domain.OrderStatus;
import dev.nortech.norpress.settings.application.StoreSettingsService;
import dev.nortech.norpress.settings.domain.Gateway;
import dev.nortech.norpress.shared.domain.Conflict;
import dev.nortech.norpress.shared.domain.Forbidden;
import dev.nortech.norpress.shared.domain.NotFound;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.util.*;

/**
 * Paying an order with Wompi, PayU or by agreement with the store. Card data never reaches this server: the shopper
 * pays on the gateway's own page. An order is marked paid from two independent proofs, whichever comes first: the
 * gateway's signed notification, or a check made when the shopper returns. Both pass through `settle`, which acts once.
 */
@ApplicationScoped
public class PaymentService {
    static final String WOMPI_CHECKOUT = "https://checkout.wompi.co/p/";
    static final String PAYU_LIVE = "https://checkout.payulatam.com/ppp-web-gateway-payu/", PAYU_SANDBOX = "https://sandbox.checkout.payulatam.com/ppp-web-gateway-payu/";
    /** How the browser continues: go to `url`, post `fields` to `url`, or just read the `instructions`. */
    public record Instruction(String kind, String url, Map<String, String> fields, String instructions) {}
    public record Outcome(String status, String message) {}

    @Inject StorefrontOrders orders;
    @Inject OrderService orderService;
    @Inject StoreSettingsService settings;
    @Inject AttemptRepository attempts;
    @Inject WompiApi wompi;
    @Inject dev.nortech.norpress.notifications.application.NotificationService notifications;
    @Inject JsonReader json;
    @Inject Secrets secrets;
    Clock clock = Clock.systemUTC();

    /** The shopper's view of an order plus what they can do about its payment. */
    public Map<String, Object> view(StorefrontOrders.Access access) {
        var view = new LinkedHashMap<>(orders.view(access).orElseThrow(() -> new NotFound("Pedido no encontrado")));
        boolean pending = "pending".equals(view.get("status"));
        var active = settings.activeGateway().orElse(null);
        // an order made in test mode is only paid in test mode, and the other way around
        boolean sameMode = active != null && (!active.code().hasEnvironments() || Boolean.TRUE.equals(view.get("test")) == settings.payments().test());
        view.put("canPay", pending && sameMode && active.code() != Gateway.Code.MANUAL);
        view.put("payWith", pending && sameMode ? active.code().label : "");
        view.put("instructions", pending && active != null && active.code() == Gateway.Code.MANUAL ? active.config().getOrDefault("instructions", "") : "");
        // the store decides whether shoppers cancel on their own
        view.put("canCancel", Boolean.TRUE.equals(view.get("canCancel")) && settings.checkout().shopperCancels());
        return view;
    }

    /** Opens a new try at paying the order. `site` is the store's own public address, from the server configuration. */
    @Transactional
    /** back is where the gateway returns the shopper: the order page they came from. */
    public Instruction start(StorefrontOrders.Access access, String back, String site) {
        Payable order = orders.payable(access).orElseThrow(() -> new NotFound("Pedido no encontrado"));
        if (order.status() != OrderStatus.PENDING) throw new Conflict(order.status().paid() ? "Este pedido ya está pagado" : "Este pedido ya no admite pagos");
        Gateway gateway = settings.activeGateway().orElseThrow(() -> new Conflict("La tienda no está recibiendo pagos en este momento. Escríbenos por WhatsApp."));
        boolean test = gateway.code().hasEnvironments() && settings.payments().test();
        if (gateway.code().hasEnvironments() && order.test() != test)
            throw new Conflict(order.test() ? "Este pedido se hizo en modo de pruebas y la tienda ya cobra de verdad. Haz el pedido de nuevo." : "La tienda está en modo de pruebas; este pedido se paga cuando vuelva a cobrar de verdad.");
        if (!gateway.code().db().equals(order.paymentMethod())) orders.setPaymentMethod(order.id(), gateway.code().db(), gateway.code().label);

        // gateways refuse a reference they have seen, so each try gets its own; only letters and digits
        String reference = "ARI" + order.number() + "T" + Long.toString(clock.millis() / 1000, 36).toUpperCase(Locale.ROOT);
        BigDecimal amount = order.total().setScale(0, RoundingMode.HALF_UP);
        attempts.insert(new Attempt(reference, order.id(), gateway.code().db(), amount, test, gateway.code() == Gateway.Code.MANUAL ? PaymentState.PENDING : PaymentState.STARTED, ""));
        return switch (gateway.code()) {
            case MANUAL -> new Instruction("manual", null, Map.of(), gateway.config().get("instructions"));
            case WOMPI -> {
                long cents = amount.longValueExact() * 100;
                var q = new LinkedHashMap<String, String>();
                q.put("public-key", gateway.config().get("publicKey")); q.put("currency", "COP"); q.put("amount-in-cents", String.valueOf(cents)); q.put("reference", reference);
                q.put("signature:integrity", Signatures.wompiIntegrity(reference, cents, "COP", gateway.secrets().get("integritySecret")));
                q.put("redirect-url", back);
                if (!order.email().isBlank()) q.put("customer-data:email", order.email());
                if (!order.buyerName().isBlank()) q.put("customer-data:full-name", order.buyerName());
                var url = new StringBuilder(WOMPI_CHECKOUT).append('?');
                q.forEach((name, value) -> url.append(enc(name).replace("%3A", ":")).append('=').append(enc(value)).append('&'));
                yield new Instruction("redirect", url.substring(0, url.length() - 1), Map.of(), null);
            }
            case PAYU -> {
                var b = order.billing(); var s = order.shipping();
                var f = new LinkedHashMap<String, String>();
                String merchant = gateway.config().get("merchantId"), value = amount.toPlainString();
                f.put("merchantId", merchant); f.put("accountId", gateway.config().get("accountId")); f.put("description", "Pedido " + order.number() + " en " + settings.profile().shortName());
                f.put("referenceCode", reference); f.put("amount", value); f.put("tax", order.tax().setScale(2, RoundingMode.HALF_UP).toPlainString());
                f.put("taxReturnBase", (order.tax().signum() == 0 ? BigDecimal.ZERO : order.taxBase()).setScale(2, RoundingMode.HALF_UP).toPlainString());
                f.put("currency", "COP"); f.put("algorithmSignature", "SHA256"); f.put("signature", Signatures.payuForm(gateway.secrets().get("apiKey"), merchant, reference, value, "COP"));
                f.put("test", test ? "1" : "0"); f.put("lng", "es");
                String name = order.buyerName(), phone = b.getOrDefault("phone", ""), docType = b.getOrDefault("id_type", "CC"), doc = b.getOrDefault("id", "");
                f.put("buyerFullName", name); f.put("buyerEmail", order.email()); f.put("buyerDocumentType", docType); f.put("buyerDocument", doc); f.put("telephone", phone);
                f.put("payerFullName", name); f.put("payerEmail", order.email()); f.put("payerPhone", phone); f.put("payerDocumentType", docType); f.put("payerDocument", doc);
                if (!s.getOrDefault("address_1", "").isBlank()) { f.put("shippingAddress", s.get("address_1")); f.put("shippingCity", s.getOrDefault("city", "")); f.put("shippingCountry", "CO"); }
                f.put("responseUrl", back); f.put("confirmationUrl", site + "/api/pagos/payu");
                yield new Instruction("form", test ? PAYU_SANDBOX : PAYU_LIVE, f, null);
            }
        };
    }

    /** The shopper is back from the gateway with whatever it put in the address. Nothing here is trusted until verified. */
    @Transactional
    public Outcome confirmReturn(StorefrontOrders.Access access, Map<String, String> params) {
        Payable order = orders.payable(access).orElseThrow(() -> new NotFound("Pedido no encontrado"));
        var p = params == null ? Map.<String, String>of() : params;
        PaymentState state = null;
        if (p.containsKey("referenceCode") && p.containsKey("transactionState")) state = payuReturn(order, p);
        else if (p.containsKey("id")) state = wompiReturn(order, p.get("id"));
        // no id (the shopper closed Wompi before it sent them back, or came from "Mis pedidos"): ask Wompi by reference
        if (state == null) state = wompiByReference(order);
        if (state == null) state = attempts.latest(order.id()).map(Attempt::status).orElse(PaymentState.PENDING);
        // with the gateway's reason when the try failed ("Número no válido en Sandbox"), so the shopper knows what to change
        final PaymentState result = state;
        String message = result == PaymentState.APPROVED ? result.message()
            : attempts.latest(order.id()).filter(a -> a.status() == result && a.detail() != null && !a.detail().isBlank()).map(Attempt::detail).orElse(result.message());
        return new Outcome(result.db(), message);
    }

    /**
     * Called right before unpaid orders are cancelled: asks Wompi only about those whose time ran out, so an order paid
     * while nobody was looking (the shopper closed Wompi before coming back, an event that never arrived) is marked paid
     * instead of cancelled. Nothing polls in between: a shopper or the team opening the order checks it too.
     */
    public int reconcileExpired(java.time.Instant now) {
        int settled = 0;
        for (var attempt : attempts.open("wompi", now.minus(java.time.Duration.ofDays(30)), 100)) {
            boolean expired = orders.payable(attempt.orderId()).map(o -> o.expiresAt() != null && !o.expiresAt().isAfter(now)).orElse(false);
            if (!expired) continue;
            try { if (self.reconcile(attempt.orderId()) == PaymentState.APPROVED) settled++; } catch (RuntimeException ignored) { /* the gateway did not answer: next round */ }
        }
        return settled;
    }
    /** The team opened the order in the panel: if it waits for a Wompi payment, ask Wompi now. */
    @Transactional(Transactional.TxType.REQUIRES_NEW)
    public PaymentState reconcile(UUID orderId) {
        return orders.payable(orderId).map(this::wompiByReference).orElse(null);
    }
    @jakarta.inject.Inject PaymentService self;

    private PaymentState wompiByReference(Payable order) {
        if (order.status() != OrderStatus.PENDING) return null;
        var latest = attempts.latest(order.id()).filter(a -> a.gateway().equals("wompi") && a.status() != PaymentState.APPROVED).orElse(null);
        if (latest == null) return null;
        String privateKey = settings.credentials(Gateway.Code.WOMPI, latest.sandbox()).secrets().get("privateKey");
        if (privateKey == null) return null;
        var tx = wompi.byReference(latest.sandbox(), privateKey, latest.reference()).filter(t -> t.reference().equals(latest.reference())).orElse(null);
        if (tx == null) return null;
        return settle(latest, PaymentState.ofWompi(tx.status()), tx.id(), tx.paymentMethodType(), BigDecimal.valueOf(tx.amountInCents(), 2), tx.currency(), tx.statusMessage());
    }

    private PaymentState wompiReturn(Payable order, String transactionId) {
        if (transactionId == null || transactionId.length() > 80 || !transactionId.matches("[A-Za-z0-9_-]+")) return null;
        // the keys are those of the environment the order was paid in, whatever the store uses now
        var latest = attempts.latest(order.id()).filter(a -> a.gateway().equals("wompi")).orElse(null);
        if (latest == null) return null;
        String privateKey = settings.credentials(Gateway.Code.WOMPI, latest.sandbox()).secrets().get("privateKey");
        if (privateKey == null) return null;
        var tx = wompi.transaction(latest.sandbox(), privateKey, transactionId).orElse(null);
        if (tx == null) return null;
        var attempt = attempts.find(tx.reference()).filter(a -> a.orderId().equals(order.id()) && a.gateway().equals("wompi") && a.sandbox() == latest.sandbox()).orElse(null);
        if (attempt == null) return null;
        return settle(attempt, PaymentState.ofWompi(tx.status()), tx.id(), tx.paymentMethodType(), BigDecimal.valueOf(tx.amountInCents(), 2), tx.currency(), tx.statusMessage());
    }
    private PaymentState payuReturn(Payable order, Map<String, String> p) {
        String value = p.getOrDefault("TX_VALUE", "");
        var attempt = attempts.find(p.get("referenceCode")).filter(a -> a.orderId().equals(order.id()) && a.gateway().equals("payu")).orElse(null);
        String apiKey = attempt == null ? null : settings.credentials(Gateway.Code.PAYU, attempt.sandbox()).secrets().get("apiKey");
        if (apiKey == null || attempt == null || !value.matches("\\d{1,12}(\\.\\d{1,4})?")) return null;
        if (!Signatures.payuMatches(p.get("signature"), apiKey, p.getOrDefault("merchantId", ""), attempt.reference(), Signatures.payuResponseValue(value), p.getOrDefault("currency", ""), p.get("transactionState"))) return null;
        return settle(attempt, PaymentState.ofPayu(p.get("transactionState")), p.getOrDefault("transactionId", p.get("reference_pol")), p.get("lapPaymentMethod"), new BigDecimal(value), p.get("currency"), p.get("message"));
    }

    /** Wompi event. Refused unless its checksum matches the events secret. */
    @Transactional
    public void wompiEvent(String body, String headerChecksum) {
        Map<String, Object> event;
        try { event = json.flatten(body); } catch (RuntimeException e) { throw new IllegalArgumentException("Evento inválido"); }
        // Wompi says which environment sent the event; only that environment's secret can sign it
        boolean test = !"prod".equals(event.get("environment"));
        String secret = settings.credentials(Gateway.Code.WOMPI, test).secrets().get("eventsSecret");
        if (secret == null) throw new Forbidden("Eventos de Wompi no configurados para " + (test ? "pruebas" : "producción"));
        if (!(event.get("signature.properties") instanceof List<?> properties) || !(event.get("timestamp") instanceof Number timestamp)) throw new IllegalArgumentException("Evento sin firma");
        var values = new ArrayList<String>();
        for (Object property : properties) values.add(Objects.toString(event.get("data." + property), ""));
        String expected = Signatures.wompiEvent(values, timestamp.longValue(), secret);
        String given = headerChecksum != null && !headerChecksum.isBlank() ? headerChecksum : Objects.toString(event.get("signature.checksum"), "");
        if (!Signatures.same(given.trim(), expected)) throw new Forbidden("Firma del evento inválida");
        if (!"transaction.updated".equals(event.get("event"))) return;
        var attempt = attempts.find(Objects.toString(event.get("data.transaction.reference"), "")).filter(a -> a.gateway().equals("wompi") && a.sandbox() == test).orElse(null);
        if (attempt == null || !(event.get("data.transaction.amount_in_cents") instanceof Number cents)) return;
        settle(attempt, PaymentState.ofWompi(Objects.toString(event.get("data.transaction.status"), "")), Objects.toString(event.get("data.transaction.id"), null),
            Objects.toString(event.get("data.transaction.payment_method_type"), null), BigDecimal.valueOf(cents.longValue(), 2), Objects.toString(event.get("data.transaction.currency"), ""),
            Objects.toString(event.get("data.transaction.status_message"), null));
    }

    /** PayU confirmation (form fields). Refused unless `sign` matches the API key. */
    @Transactional
    public void payuConfirmation(Map<String, String> f) {
        String value = f.getOrDefault("value", ""), reference = f.getOrDefault("reference_sale", "");
        if (!value.matches("\\d{1,12}(\\.\\d{1,4})?")) throw new IllegalArgumentException("Confirmación inválida");
        // the reference says which payment try this is, and so which environment's key must have signed it
        var found = attempts.find(reference).filter(a -> a.gateway().equals("payu")).orElse(null);
        if (found == null) return;
        String apiKey = settings.credentials(Gateway.Code.PAYU, found.sandbox()).secrets().get("apiKey");
        if (apiKey == null) throw new Forbidden("PayU no está configurado");
        if (!Signatures.payuMatches(f.get("sign"), apiKey, f.getOrDefault("merchant_id", ""), reference, Signatures.payuConfirmationValue(value), f.getOrDefault("currency", ""), f.getOrDefault("state_pol", "")))
            throw new Forbidden("Firma de la confirmación inválida");
        java.util.Optional.of(found)
            .ifPresent(attempt -> settle(attempt, PaymentState.ofPayu(f.get("state_pol")), f.getOrDefault("transaction_id", f.get("reference_pol")), f.get("payment_method_name"), new BigDecimal(value), f.get("currency"), f.get("response_message_pol")));
    }

    /**
     * Applies a verified result to its try and, the first time it is an approval for the full amount, to the order:
     * the payment is recorded and the order moves to processing, which is what the panel reads as paid.
     */
    PaymentState settle(Attempt attempt, PaymentState state, String externalId, String paymentType, BigDecimal paid, String currency, String reason) {
        if (attempt.status() == PaymentState.APPROVED) return PaymentState.APPROVED;
        if (state == PaymentState.APPROVED && (!"COP".equalsIgnoreCase(currency) || paid == null || paid.setScale(0, RoundingMode.HALF_UP).compareTo(attempt.amount().setScale(0, RoundingMode.HALF_UP)) != 0)) {
            attempts.update(attempt.reference(), PaymentState.ERROR, externalId, "El valor pagado no coincide con el del pedido");
            return PaymentState.ERROR;
        }
        if (state != PaymentState.APPROVED) { attempts.update(attempt.reference(), state, externalId, state.message(reason)); return state; }
        if (!attempts.approve(attempt.reference(), externalId, Objects.toString(paymentType, ""))) return PaymentState.APPROVED;
        orders.recordPayment(attempt.orderId(), attempt.gateway(), externalId, paymentType, attempt.amount(), clock.instant(), attempt.gateway() + ":" + attempt.reference());
        var order = orders.payable(attempt.orderId()).orElseThrow();
        if (order.status() == OrderStatus.PENDING || order.status() == OrderStatus.ON_HOLD) notifications.paymentApproved(order.email(), order.buyerName(), order.number(), order.total(), null);
        if (order.status() == OrderStatus.PENDING || order.status() == OrderStatus.ON_HOLD) orderService.changeStatus(order.id(), OrderStatus.PROCESSING, "Pago aprobado por " + attempt.gateway() + " (" + attempt.reference() + ")", null);
        // paid after the order was cancelled (the time to pay ran out): somebody must look at it
        else if (!order.status().paid()) orderService.flagLatePayment(order.id(), attempt.reference());
        return PaymentState.APPROVED;
    }

    /**
     * The team confirms a payment received outside the gateways (a transfer, cash at the shop). It is recorded like any
     * other, the order moves to processing and the buyer gets the same email.
     */
    @Transactional
    public void registerManual(UUID orderId, String reference, UUID actor) {
        String ref = reference == null ? "" : reference.trim();
        if (ref.isEmpty() || ref.length() > 120) throw new IllegalArgumentException("Escribe la referencia del pago (número de la transferencia o recibo)");
        var order = orders.payable(orderId).orElseThrow(() -> new NotFound("Pedido no encontrado"));
        if (order.status() != OrderStatus.PENDING && order.status() != OrderStatus.ON_HOLD) throw new Conflict("Este pedido no está esperando un pago");
        orders.recordPayment(orderId, "manual", ref, "Registrado por el equipo", order.total(), clock.instant(), "manual:" + orderId + ":" + ref);
        notifications.paymentApproved(order.email(), order.buyerName(), order.number(), order.total(), null);
        orderService.changeStatus(orderId, OrderStatus.PROCESSING, "Pago registrado a mano: " + ref, actor);
    }

    /** The key the shopper received, as stored. */
    public String digest(String key) { return key == null || key.isBlank() || key.length() > 128 ? null : secrets.digest(key); }
    private static String enc(String value) { return URLEncoder.encode(value, StandardCharsets.UTF_8); }
}

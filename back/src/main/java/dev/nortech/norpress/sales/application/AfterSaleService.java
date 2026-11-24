package dev.nortech.norpress.sales.application;
import dev.nortech.norpress.notifications.application.NotificationService;
import dev.nortech.norpress.sales.domain.AfterSale;
import dev.nortech.norpress.sales.domain.OrderStatus;
import dev.nortech.norpress.sales.domain.Payout;
import dev.nortech.norpress.sales.domain.RefundRoute;
import dev.nortech.norpress.settings.application.SettingsPorts.SecretVault;
import dev.nortech.norpress.shared.domain.Conflict;
import dev.nortech.norpress.shared.domain.NotFound;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Event;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import java.math.BigDecimal;
import java.time.Clock;
import java.util.*;

/**
 * After the sale: cancelling an order and giving its money back.
 *
 * The shopper cancels on their own while the order has not left (no approval). The store cancels from the panel with
 * the same rules. A paid order then gets one refund for what is left to give back, through the gateway that charged
 * it when it can, otherwise by transfer to the account the shopper gives. Every step is safe to repeat:
 *  - the order and its refund are locked and checked again inside the transaction (a dispatch at the same moment, a
 *    second click or a second tab find the order already cancelled or the refund already there);
 *  - a refund is handed to the gateway once (`claim`), outside any transaction; no answer is never retried blindly:
 *    the store looks in the gateway's dashboard and says what happened;
 *  - a gateway that refuses sends the refund to transfer; the account data is sealed, opened only in the panel (each
 *    opening recorded) and deleted when the refund is done.
 */
@ApplicationScoped
public class AfterSaleService {
    @Inject AfterSaleRepository afterSale;
    @Inject OrderRepository orders;
    @Inject OrderService orderService;
    @Inject StorefrontOrders storefront;
    @Inject RefundGateway gateway;
    @Inject SecretVault vault;
    @Inject NotificationService notifications;
    @Inject dev.nortech.norpress.settings.application.StoreSettingsService settings;
    @Inject Event<AfterSaleChanged> changed;
    @Inject AfterSaleService self;
    @org.eclipse.microprofile.config.inject.ConfigProperty(name = "norpress.public-url", defaultValue = "http://localhost:8000") String site;
    Clock clock = Clock.systemUTC();

    /** What cancelling would do now: can it be cancelled, how much comes back and how, and whether an account is needed. */
    public record Preview(boolean canCancel, String why, BigDecimal refund, String route, String routeLabel, boolean needsAccount) {}
    record Plan(AfterSaleRepository.Standing standing, OrderStatus status, RefundRoute route, RefundRoute.Charge charge) {}

    public Preview preview(StorefrontOrders.Access access) {
        var order = storefront.payable(access).orElseThrow(() -> new NotFound("Pedido no encontrado"));
        var plan = plan(order.id(), false);
        String why = whyNot(plan, true);
        boolean money = plan.standing().left().signum() > 0;
        return new Preview(why == null, why, money ? plan.standing().left() : BigDecimal.ZERO, money ? plan.route().db() : "none",
            money ? plan.route().label : "", money && plan.route() == RefundRoute.TRANSFER);
    }

    /** The shopper cancels their order. `payout` is required when the money goes back by transfer. */
    public void cancelByShopper(StorefrontOrders.Access access, String reasonText, Payout payout) {
        String reason = AfterSale.reason(reasonText);
        var order = storefront.payable(access).orElseThrow(() -> new NotFound("Pedido no encontrado"));
        var refundId = self.cancel(order.id(), "Cancelado por el cliente: " + reason, payout, true, null);
        refundId.ifPresent(this::process);
    }
    /** The store cancels an order from the panel; a paid one is refunded the same way. */
    public void cancelByStore(UUID orderId, String note, UUID actor) {
        String text = note == null || note.isBlank() ? "Cancelado por la tienda" : note.trim();
        var refundId = self.cancel(orderId, text, null, false, actor);
        refundId.ifPresent(this::process);
    }

    @Transactional
    public Optional<UUID> cancel(UUID orderId, String note, Payout payout, boolean byShopper, UUID actor) {
        var ref = orders.lock(orderId).orElseThrow(() -> new NotFound("Pedido no encontrado"));
        var plan = plan(orderId, true);
        String why = whyNot(plan, byShopper);
        if (why != null) throw new Conflict(why);
        BigDecimal left = plan.standing().left();
        boolean money = left.signum() > 0;
        if (money && plan.route() == RefundRoute.TRANSFER && byShopper && payout == null)
            throw new IllegalArgumentException("Para devolverte el dinero por transferencia, escribe los datos de tu cuenta");
        orderService.changeStatus(orderId, OrderStatus.CANCELLED, note, actor);
        afterSale.openRequest(orderId).ifPresent(r -> afterSale.decide(r.id(), true, "", actor));
        UUID refundId = null;
        if (money) {
            String status = plan.route() == RefundRoute.TRANSFER ? "to_transfer" : "processing";
            refundId = afterSale.insertPending(orderId, left, plan.route().db(), status, byShopper ? "shopper" : "store", actor);
            if (payout != null) afterSale.savePayout(orderId, vault.seal(payout.toMap()));
            orders.recordHistory(orderId, OrderStatus.CANCELLED, OrderStatus.CANCELLED, actor, "Reembolso de " + AfterSale.pesos(left) + " " + plan.route().label.replace("tu ", "su ")
                + (payout != null ? " (" + payout.masked() + ")" : plan.route() == RefundRoute.TRANSFER ? " (falta la cuenta del cliente)" : ""));
        }
        var s = plan.standing();
        notifications.orderCancelled(s.email(), s.name(), ref.number(), money ? left : null, money ? plan.route().label : null, link(ref.number()));
        changed.fire(new AfterSaleChanged(orderId));
        return plan.route() == RefundRoute.TRANSFER ? Optional.empty() : Optional.ofNullable(refundId);
    }

    /**
     * Hands a refund to its gateway, once, outside any transaction, and applies the answer. A PayU refund waits until
     * 10 minutes after the charge; the periodic job sends it then.
     */
    public void process(UUID refundId) {
        var row = afterSale.refund(refundId).orElse(null);
        if (row == null || !row.status().equals("processing") || row.sentAt() != null) return;
        var charge = gateway.charge(row.orderId()).orElse(null);
        var route = RefundRoute.valueOf(row.route().toUpperCase(Locale.ROOT));
        if (!RefundRoute.readyToSend(route, charge, clock.instant())) return;
        if (charge == null || !gateway.ready(charge)) { self.toTransfer(refundId, "La tienda no tiene las credenciales de la pasarela para reembolsar"); return; }
        if (!self.claim(refundId)) return;
        var standing = afterSale.standing(row.orderId()).orElseThrow();
        boolean whole = row.amount().compareTo(standing.paid()) >= 0;
        RefundGateway.Result result;
        try { result = gateway.refund(charge, row.amount(), whole, "Cancelación del pedido #" + standing.number()); }
        catch (RuntimeException e) { result = RefundGateway.Result.unknown("La pasarela no respondió"); }
        self.apply(refundId, result);
    }
    @Transactional public boolean claim(UUID refundId) { return afterSale.claim(refundId); }

    /** What the gateway answered, applied to the refund and the order. */
    @Transactional
    public void apply(UUID refundId, RefundGateway.Result result) {
        var row = afterSale.refund(refundId).orElseThrow(() -> new NotFound("Reembolso no encontrado"));
        boolean last = result.outcome() == RefundGateway.Outcome.APPROVED || result.outcome() == RefundGateway.Outcome.DECLINED;
        // one the store has to check still takes the gateway's final answer when asked about it
        if (!row.status().equals("processing") && !(row.status().equals("checking") && last)) return;
        if (row.status().equals("checking")) afterSale.update(refundId, "processing", row.gatewayReference(), row.failure());
        switch (result.outcome()) {
            case APPROVED -> finish(row, "gateway", result.gatewayReference(), null);
            case PENDING -> afterSale.update(refundId, "processing", result.gatewayReference(), result.message() == null ? "" : result.message());
            case DECLINED -> toTransfer(refundId, "La pasarela no hizo el reembolso" + (result.message() == null || result.message().isBlank() ? "" : ": " + result.message()));
            case UNKNOWN -> {
                // with the gateway's id the job keeps asking (asking never repeats the refund); without it, only the store can tell
                if (result.gatewayReference() != null && !result.gatewayReference().isBlank()) {
                    afterSale.update(refundId, "processing", result.gatewayReference(), result.message() == null ? "" : result.message());
                    break;
                }
                afterSale.update(refundId, "checking", "", "La pasarela no respondió. Revisa en su panel si el reembolso se hizo antes de hacer otra cosa.");
                orders.recordHistory(row.orderId(), currentStatus(row.orderId()), currentStatus(row.orderId()), null, "La pasarela no respondió al reembolso: hay que revisarlo en su panel");
            }
        }
        changed.fire(new AfterSaleChanged(row.orderId()));
    }

    /** A day with the gateway without a final answer: the store looks in its dashboard. */
    @Transactional
    public void stuck(UUID refundId) {
        var row = afterSale.refund(refundId).orElse(null);
        if (row == null || !row.status().equals("processing")) return;
        afterSale.update(refundId, "checking", row.gatewayReference(), "La pasarela no ha confirmado el reembolso en un día. Revísalo en su panel.");
        changed.fire(new AfterSaleChanged(row.orderId()));
    }

    /** The gateway refused, or cannot be used: the store transfers it to the shopper's account. */
    @Transactional
    public void toTransfer(UUID refundId, String failure) {
        var row = afterSale.refund(refundId).orElseThrow(() -> new NotFound("Reembolso no encontrado"));
        if (row.status().equals("succeeded") || row.status().equals("to_transfer")) return;
        afterSale.update(refundId, "to_transfer", row.gatewayReference(), failure);
        var status = currentStatus(row.orderId());
        orders.recordHistory(row.orderId(), status, status, null, failure + ". Pasa a transferencia" + (afterSale.payout(row.orderId()).isPresent() ? "" : " (falta la cuenta del cliente)"));
        changed.fire(new AfterSaleChanged(row.orderId()));
    }

    /** The periodic job: refunds never sent (the server stopped, PayU's 10 minutes) and those PayU left pending. */
    public int processPending() {
        int moved = 0;
        for (var row : afterSale.pending(50)) {
            try {
                if (row.sentAt() == null) { process(row.id()); moved++; continue; }
                var charge = gateway.charge(row.orderId()).orElse(null);
                if (charge == null || row.gatewayReference().isBlank()) continue;
                var result = gateway.check(charge, row.gatewayReference());
                // pending stays pending and no answer is not a result; a day without a final answer goes to the store
                if (result.outcome() == RefundGateway.Outcome.APPROVED || result.outcome() == RefundGateway.Outcome.DECLINED) { self.apply(row.id(), result); moved++; }
                else if (row.status().equals("processing") && row.sentAt().plus(java.time.Duration.ofDays(1)).isBefore(clock.instant())) { self.stuck(row.id()); moved++; }
            } catch (RuntimeException ignored) { /* the next round asks again */ }
        }
        return moved;
    }

    /** The shopper gives (or corrects) the account for a refund waiting for a transfer. */
    @Transactional
    public void giveAccount(StorefrontOrders.Access access, Payout payout) {
        if (payout == null) throw new IllegalArgumentException("Escribe los datos de tu cuenta");
        var order = storefront.payable(access).orElseThrow(() -> new NotFound("Pedido no encontrado"));
        orders.lock(order.id());
        var row = afterSale.openRefund(order.id()).filter(r -> r.status().equals("to_transfer"))
            .orElseThrow(() -> new Conflict("Este pedido no tiene un reembolso esperando tu cuenta"));
        afterSale.savePayout(order.id(), vault.seal(payout.toMap()));
        var status = currentStatus(order.id());
        orders.recordHistory(order.id(), status, status, null, "El cliente dio su cuenta para el reembolso (" + payout.masked() + ")");
        changed.fire(new AfterSaleChanged(row.orderId()));
    }

    /** The account to transfer to, for the panel only; every opening is written in the order's history. */
    @Transactional
    public Payout viewAccount(UUID orderId, UUID actor) {
        orders.lock(orderId).orElseThrow(() -> new NotFound("Pedido no encontrado"));
        var sealed = afterSale.payout(orderId).orElseThrow(() -> new NotFound("El cliente aún no ha dado su cuenta"));
        var payout = Payout.fromMap(vault.open(sealed));
        var status = currentStatus(orderId);
        orders.recordHistory(orderId, status, status, actor, "Se vieron los datos de la cuenta para el reembolso");
        return payout;
    }

    /** The store transferred the money (or confirms, after looking at the gateway, that it went back). */
    @Transactional
    public void completeTransfer(UUID orderId, String reference, UUID actor) {
        String ref = reference == null ? "" : reference.trim();
        if (ref.isEmpty() || ref.length() > 120) throw new IllegalArgumentException("Escribe la referencia de la transferencia");
        orders.lock(orderId).orElseThrow(() -> new NotFound("Pedido no encontrado"));
        var row = afterSale.openRefund(orderId).filter(r -> r.status().equals("to_transfer"))
            .orElseThrow(() -> new Conflict("Este pedido no tiene un reembolso por transferir"));
        if (afterSale.payout(orderId).isEmpty() && row.status().equals("to_transfer"))
            throw new Conflict("El cliente aún no ha dado su cuenta. Pídesela o espera a que la escriba en su pedido.");
        finish(row, "transfer", ref, actor);
        changed.fire(new AfterSaleChanged(orderId));
    }
    /** After a gateway did not answer, the store looked in its dashboard: did the refund happen? */
    @Transactional
    public void confirmChecked(UUID orderId, boolean refunded, String reference, UUID actor) {
        orders.lock(orderId).orElseThrow(() -> new NotFound("Pedido no encontrado"));
        var row = afterSale.openRefund(orderId).filter(r -> r.status().equals("checking"))
            .orElseThrow(() -> new Conflict("Este pedido no tiene un reembolso por revisar"));
        if (refunded) finish(row, "gateway", reference == null || reference.isBlank() ? row.gatewayReference() : reference.trim(), actor);
        else toTransfer(row.id(), "La tienda revisó la pasarela: el reembolso no se hizo");
        changed.fire(new AfterSaleChanged(orderId));
    }

    /** Done: recorded, the account deleted, the order refunded when everything paid is back, the shopper told. */
    private void finish(AfterSaleRepository.RefundRow row, String method, String reference, UUID actor) {
        afterSale.complete(row.id(), method, reference == null ? "" : reference, actor);
        afterSale.deletePayout(row.orderId());
        var standing = afterSale.standing(row.orderId()).orElseThrow();
        var ref = orders.lock(row.orderId()).orElseThrow();
        String note = "Reembolso hecho: " + AfterSale.pesos(row.amount()) + (reference == null || reference.isBlank() ? "" : " (ref. " + reference + ")");
        if (standing.refunded().compareTo(standing.paid()) >= 0 && ref.status().canMoveTo(OrderStatus.REFUNDED)) orderService.changeStatus(row.orderId(), OrderStatus.REFUNDED, note, actor);
        else orders.recordHistory(row.orderId(), ref.status(), ref.status(), actor, note);
        notifications.refundCompleted(standing.email(), standing.name(), standing.number(), row.amount(), routeLabel(row.route()), link(standing.number()));
    }

    /** Money the store already gave back on its own (a returned package, for example). */
    @Transactional
    public void recordRefund(UUID orderId, AfterSale.Refund refund, UUID actor) {
        var ref = orders.lock(orderId).orElseThrow(() -> new NotFound("Pedido no encontrado"));
        var standing = afterSale.standing(orderId).orElseThrow(() -> new NotFound("Pedido no encontrado"));
        if (standing.paid().signum() <= 0) throw new Conflict("Este pedido no tiene pagos: no hay nada que devolver");
        if (standing.inProgress().signum() > 0) throw new Conflict("Este pedido ya tiene un reembolso en curso: termínalo primero");
        refund.requireWithin(standing.paid(), standing.refunded());
        afterSale.insertRefund(orderId, refund, actor);
        String note = "Reembolso de " + AfterSale.pesos(refund.amount()) + " " + refund.method().label + (refund.reference().isEmpty() ? "" : " (ref. " + refund.reference() + ")");
        boolean all = standing.refunded().add(refund.amount()).compareTo(standing.paid()) >= 0;
        if (all && ref.status().canMoveTo(OrderStatus.REFUNDED)) orderService.changeStatus(orderId, OrderStatus.REFUNDED, note, actor);
        else orders.recordHistory(orderId, ref.status(), ref.status(), actor, note);
        changed.fire(new AfterSaleChanged(orderId));
    }

    /** An old request (from before shoppers cancelled on their own): approving it cancels and refunds. */
    public void approve(UUID orderId, String answerText, UUID actor) {
        AfterSale.answer(answerText, false);
        afterSale.openRequest(orderId).orElseThrow(() -> new Conflict("Este pedido no tiene una solicitud de cancelación abierta"));
        cancelByStore(orderId, "Cancelado a pedido del cliente", actor);
    }
    @Transactional
    public void reject(UUID orderId, String answerText, UUID actor) {
        String answer = AfterSale.answer(answerText, true);
        orders.lock(orderId).orElseThrow(() -> new NotFound("Pedido no encontrado"));
        var request = afterSale.openRequest(orderId).orElseThrow(() -> new Conflict("Este pedido no tiene una solicitud de cancelación abierta"));
        afterSale.decide(request.id(), false, answer, actor);
        changed.fire(new AfterSaleChanged(orderId));
    }

    private Plan plan(UUID orderId, boolean locked) {
        var standing = afterSale.standing(orderId).orElseThrow(() -> new NotFound("Pedido no encontrado"));
        var status = currentStatus(orderId);
        var charge = gateway.charge(orderId).orElse(null);
        boolean ready = charge != null && gateway.ready(charge);
        BigDecimal left = standing.left();
        var route = RefundRoute.choose(charge, ready, left, left.compareTo(standing.paid()) >= 0, standing.refunded().signum() > 0, clock.instant());
        return new Plan(standing, status, route, charge);
    }
    private String whyNot(Plan plan, boolean byShopper) {
        var s = plan.standing();
        if (byShopper && settings != null && !settings.checkout().shopperCancels()) return "Para cancelar tu pedido, escríbenos por WhatsApp y te ayudamos.";
        if (plan.status() == OrderStatus.CANCELLED || plan.status() == OrderStatus.REFUNDED || plan.status() == OrderStatus.FAILED) return "Este pedido ya está cancelado";
        if (byShopper ? !AfterSale.canAskToCancel(plan.status(), s.stage()) : !AfterSale.storeCanCancel(plan.status(), s.stage()))
            return byShopper ? "Tu pedido ya salió, así que no se puede cancelar desde aquí. Escríbenos por WhatsApp y te ayudamos." : "El pedido ya salió: cuando vuelva a la tienda, registra el reembolso";
        if (byShopper && s.migrated()) return "Este pedido es de la tienda anterior. Escríbenos por WhatsApp y te ayudamos.";
        if (s.inProgress().signum() > 0) return "Este pedido ya tiene un reembolso en curso";
        return null;
    }
    private OrderStatus currentStatus(UUID orderId) { return orders.lock(orderId).map(OrderRepository.OrderRef::status).orElseThrow(() -> new NotFound("Pedido no encontrado")); }
    private String link(String number) { return site == null ? null : site.replaceAll("/+$", "") + "/cuenta/pedidos/" + java.net.URLEncoder.encode(number, java.nio.charset.StandardCharsets.UTF_8); }
    private static String routeLabel(String route) {
        return switch (route) { case "wompi" -> RefundRoute.WOMPI.label; case "payu" -> RefundRoute.PAYU.label; default -> RefundRoute.TRANSFER.label; };
    }
}

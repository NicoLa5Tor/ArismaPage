package dev.nortech.norpress.sales.application;
import dev.nortech.norpress.inventory.application.StockLedger;
import dev.nortech.norpress.sales.domain.OrderStatus;
import dev.nortech.norpress.shared.domain.NotFound;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Event;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import java.util.*;

/** Order use cases: status changes (single and bulk) and internal notes. */
@ApplicationScoped
public class OrderService {
    public record BulkResult(int updated, List<Failure> failed) {}
    public record Failure(UUID id, String error) {}
    static final int MAX_BULK = 200, MAX_NOTE = 4000;
    @Inject OrderRepository orders;
    @Inject StockLedger stock;
    @Inject OrderService self;
    @Inject Event<OrderStatusChanged> events;

    @Transactional
    public void changeStatus(UUID id, OrderStatus next, String note, UUID actor) {
        var order = orders.lock(id).orElseThrow(() -> new NotFound("Pedido no encontrado"));
        order.status().requireMoveTo(next);
        orders.moveTo(id, next);
        orders.recordHistory(id, order.status(), next, actor, note == null ? "" : note.trim());
        if (next.releasesStock())
            for (var line : orders.lockReducedLines(id)) {
                stock.returnToStock(line.productId(), line.quantity(), line.lineId(), "Devolución por pedido #" + order.number() + " " + next.label(), actor);
                orders.markReturned(line.lineId());
            }
        events.fire(new OrderStatusChanged(id, order.status(), next, actor));
    }

    /**
     * Handing the order over closes it: paid orders become completed; cash-on-delivery and on-hold orders go through processing first.
     * Orders already completed, or cancelled, are left as they are.
     */
    @Transactional
    public void completeOnDelivery(UUID id, UUID actor) {
        var order = orders.lock(id).orElseThrow(() -> new NotFound("Pedido no encontrado"));
        switch (order.status()) {
            case PENDING, ON_HOLD -> { changeStatus(id, OrderStatus.PROCESSING, "Pago recibido al entregar", actor); changeStatus(id, OrderStatus.COMPLETED, "Entregado al cliente", actor); }
            case PROCESSING -> changeStatus(id, OrderStatus.COMPLETED, "Entregado al cliente", actor);
            default -> { }
        }
    }

    /** Each order changes in its own transaction, so one invalid transition does not undo the others. */
    public BulkResult changeStatuses(List<UUID> ids, OrderStatus next, String note, UUID actor) {
        if (ids == null || ids.isEmpty() || ids.size() > MAX_BULK || ids.stream().anyMatch(Objects::isNull)) throw new IllegalArgumentException("Selecciona entre 1 y " + MAX_BULK + " pedidos");
        if (next == null) throw new IllegalArgumentException("Indica el nuevo estado");
        int updated = 0; var failed = new ArrayList<Failure>();
        for (UUID id : new LinkedHashSet<>(ids)) {
            try { self.changeStatusAlone(id, next, note, actor); updated++; }
            catch (IllegalArgumentException | NotFound e) { failed.add(new Failure(id, e.getMessage())); }
        }
        return new BulkResult(updated, failed);
    }
    /** Public only so the call goes through the CDI proxy and opens its own transaction; use changeStatuses. */
    @Transactional(Transactional.TxType.REQUIRES_NEW)
    public void changeStatusAlone(UUID id, OrderStatus next, String note, UUID actor) { changeStatus(id, next, note, actor); }

    /** A payment arrived for an order that is no longer waiting for one and could not be brought back: a visible trace for the team. */
    @Transactional
    public void flagLatePayment(UUID id, String reference, String why) {
        var order = orders.lock(id).orElseThrow(() -> new NotFound("Pedido no encontrado"));
        orders.recordHistory(id, order.status(), order.status(), null, "Llegó un pago aprobado (" + reference + ") con el pedido " + order.status().label()
            + (why == null || why.isBlank() ? "" : ": " + why) + ". Reactívalo cuando haya unidades o devuelve el dinero.");
    }

    /**
     * An unpaid store order whose time to pay ran out: cancelled, its units back on the shelf, and marked as expired so
     * a payment that still arrives can bring it back. False when it is no longer waiting for a payment.
     */
    @Transactional(Transactional.TxType.REQUIRES_NEW)
    public boolean expireUnpaid(UUID id) {
        var order = orders.lock(id).orElse(null);
        if (order == null || order.status() != OrderStatus.PENDING) return false;
        changeStatus(id, OrderStatus.CANCELLED, "Venció el plazo para pagar", null);
        orders.markExpired(id, true);
        return true;
    }

    /**
     * Brings back an order cancelled because its time to pay ran out, now that its money arrived: it takes its units off
     * the shelf again and goes on as paid. Nothing changes when a unit is missing: the answer says which one. Returns
     * null when the order is back.
     */
    @Transactional
    public String revive(UUID id, String note, UUID actor) {
        var order = orders.lock(id).orElseThrow(() -> new NotFound("Pedido no encontrado"));
        if (order.status() != OrderStatus.CANCELLED || !orders.revivable(id)) return "el pedido no se canceló por falta de pago o ya tiene una devolución";
        boolean test = orders.test(id);
        var lines = orders.lockLines(id);
        // every unit is checked first (each product stays locked), so a missing one leaves the order as it was
        if (!test) for (var line : lines) if (!stock.canTake(line.productId(), line.quantity())) return "ya no hay unidades suficientes de «" + line.title() + "»";
        if (!test) for (var line : lines) {
            int taken = stock.takeForSale(line.productId(), line.quantity(), line.lineId(), "Venta en la tienda, pedido #" + order.number() + " reactivado");
            if (taken > 0) orders.markReduced(line.lineId(), taken);
        }
        orders.moveTo(id, OrderStatus.PROCESSING);
        orders.recordHistory(id, OrderStatus.CANCELLED, OrderStatus.PROCESSING, actor, note == null ? "" : note.trim());
        orders.markExpired(id, false);
        events.fire(new OrderStatusChanged(id, OrderStatus.CANCELLED, OrderStatus.PROCESSING, actor));
        return null;
    }

    /** A migrated order that still needs attention comes back to the work list, or goes back to the history. */
    @Transactional
    public void keepActive(UUID id, boolean active, UUID actor) {
        var order = orders.lock(id).orElseThrow(() -> new NotFound("Pedido no encontrado"));
        orders.keepActive(id, active);
        orders.recordHistory(id, order.status(), order.status(), actor, active ? "Se trajo de vuelta a la lista de pedidos" : "Se envió al historial");
    }

    /** Something that happened to the order without changing its status (an invoice sent, for example), kept in its history. */
    @Transactional
    public void logEvent(UUID id, String note, UUID actor) {
        var order = orders.lock(id).orElseThrow(() -> new NotFound("Pedido no encontrado"));
        orders.recordHistory(id, order.status(), order.status(), actor, note);
    }

    @Transactional
    public Map<String, Object> addNote(UUID id, String body, UUID actor) {
        if (body == null || body.isBlank() || body.length() > MAX_NOTE) throw new IllegalArgumentException("Escribe una nota de máximo 4.000 caracteres");
        orders.lock(id).orElseThrow(() -> new NotFound("Pedido no encontrado"));
        return orders.addNote(id, body.trim(), actor);
    }
}

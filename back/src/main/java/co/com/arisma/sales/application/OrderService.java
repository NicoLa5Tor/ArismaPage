package co.com.arisma.sales.application;
import co.com.arisma.inventory.application.StockLedger;
import co.com.arisma.sales.domain.OrderStatus;
import co.com.arisma.shared.domain.NotFound;
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

    @Transactional
    public Map<String, Object> addNote(UUID id, String body, UUID actor) {
        if (body == null || body.isBlank() || body.length() > MAX_NOTE) throw new IllegalArgumentException("Escribe una nota de máximo 4.000 caracteres");
        orders.lock(id).orElseThrow(() -> new NotFound("Pedido no encontrado"));
        return orders.addNote(id, body.trim(), actor);
    }
}

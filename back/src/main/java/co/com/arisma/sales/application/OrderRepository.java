package co.com.arisma.sales.application;
import co.com.arisma.sales.domain.OrderStatus;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/** Write side of orders. Callers run inside a transaction; lock methods hold row locks until it ends. */
public interface OrderRepository {
    record OrderRef(UUID id, String number, OrderStatus status) {}
    /** An order line whose sale reduced stock that has not been returned yet. */
    record ReducedLine(UUID lineId, UUID productId, int quantity) {}
    Optional<OrderRef> lock(UUID id);
    void moveTo(UUID id, OrderStatus next);
    void recordHistory(UUID id, OrderStatus from, OrderStatus to, UUID actor, String note);
    List<ReducedLine> lockReducedLines(UUID id);
    void markReturned(UUID lineId);
    Map<String, Object> addNote(UUID id, String body, UUID actor);
}

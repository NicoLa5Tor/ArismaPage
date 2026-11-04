package co.com.arisma.sales.application;
import co.com.arisma.sales.domain.OrderStatus;
import co.com.arisma.shared.application.Page;
import co.com.arisma.shared.domain.DateWindow;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/** Read side of orders. */
public interface OrderQueries {
    /** Stages of the order journey (see V9 v_order_stage): payment and delivery seen as one. */
    java.util.Set<String> STAGES = java.util.Set.of("unpaid", "to_prepare", "packed", "shipped", "delivered", "issue", "cancelled");
    /** stage: comma-separated stages (e.g. "to_prepare,packed"), or blank for all. */
    record Filter(OrderStatus status, DateWindow window, String query, String stage) {
        public Filter {
            if (stage != null && !stage.isBlank() && !java.util.Arrays.stream(stage.split(",")).allMatch(STAGES::contains)) throw new IllegalArgumentException("Etapa de pedido inválida");
        }
    }
    /** One page of orders plus the totals the list header shows: amount for the filter and counts per stage (ignoring the stage filter). */
    record OrderList(List<Map<String, Object>> items, long total, BigDecimal amount, Map<String, Long> stageCounts) {}
    OrderList list(Filter filter, Page.Request page);
    Optional<Map<String, Object>> detail(UUID id);
}

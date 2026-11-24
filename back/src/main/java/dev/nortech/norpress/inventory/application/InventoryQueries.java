package dev.nortech.norpress.inventory.application;
import dev.nortech.norpress.inventory.domain.MovementKind;
import dev.nortech.norpress.shared.application.Page;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Read side of the inventory module. */
public interface InventoryQueries {
    Page movements(UUID productId, MovementKind kind, String query, Page.Request page);
    /** Published, stock-tracked products at or below the threshold, most demanded first. */
    List<Map<String, Object>> lowStock(int threshold, int limit);
}

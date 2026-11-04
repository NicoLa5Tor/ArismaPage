package co.com.arisma.catalog.application;
import co.com.arisma.catalog.domain.Product;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Product persistence port. Callers that write run inside a transaction. */
public interface ProductRepository {
    /** Product plus derived values the panel shows: tax-inclusive prices and sales so far. */
    record ProductView(@com.fasterxml.jackson.annotation.JsonUnwrapped Product product, BigDecimal taxPercent, BigDecimal regularPriceWithTax, BigDecimal salePriceWithTax, boolean saleActive, long unitsSold, UUID imageId, String imageUrl) {}
    /** Current stock of an existing product (quantity may be null when stock is not tracked). */
    record Stock(Integer quantity) {}
    List<ProductView> search(String query, Product.Status status, int limit, int offset);
    Optional<ProductView> view(UUID id);
    /** Locks the product row; empty when the product does not exist yet. */
    Optional<Stock> lockStock(UUID id);
    boolean taxRateActive(UUID taxRateId);
    void upsert(Product product);
}

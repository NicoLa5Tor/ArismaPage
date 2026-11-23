package co.com.arisma.catalog.application;
import co.com.arisma.catalog.domain.ProductPage;
import java.util.Optional;
import java.util.UUID;

/** Persistence port for the content of product pages. Writes run inside the caller's transaction. */
public interface ProductPageRepository {
    /** Empty when the product does not exist. The description comes back as stored. */
    Optional<ProductPage> find(UUID productId);
    /** Replaces the page and marks the product as changed, so the search index picks up the new text. False when the product does not exist. */
    boolean replace(UUID productId, ProductPage page);
}

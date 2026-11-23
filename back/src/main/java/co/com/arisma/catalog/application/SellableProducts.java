package co.com.arisma.catalog.application;
import co.com.arisma.catalog.domain.PageSections;
import co.com.arisma.shared.domain.Availability;
import java.math.BigDecimal;
import java.util.Collection;
import java.util.Map;
import java.util.UUID;

/**
 * What other modules may ask the catalog about products that are for sale: the price in force, availability and
 * whether the product's page offers the buy button. It is the only way checkout and reviews learn these facts.
 */
public interface SellableProducts {
    /**
     * A published product as a sale sees it. netPrice is the tax-exclusive price in force (sale or regular), null when
     * the product has no public price; onSale says that price is a running sale. buyChoice is the product's own
     * choice for the "buy" section of its page.
     */
    record Sellable(UUID id, String slug, String title, String sku, BigDecimal netPrice, boolean onSale, BigDecimal taxPercent,
                    Availability availability, PageSections.Visibility buyChoice, UUID imageId, String imageUrl, boolean imageUploaded) {}

    /** Published products among the given ids; unknown and unpublished ones are left out. */
    Map<UUID, Sellable> find(Collection<UUID> productIds);
    boolean published(UUID productId);
}

package dev.nortech.norpress.storefront.application;
import dev.nortech.norpress.storefront.domain.*;
import java.util.List;
import java.util.UUID;

/** Read-only port over the published part of the catalog. */
public interface PublicCatalog {
    List<CatalogCategory> categories();
    CatalogPage products(CatalogQuery query);
    /** Every word in the titles of published products and in category names, with how often it is used: what spelling is corrected against. */
    java.util.Map<String, Integer> vocabulary();
    /** Changes whenever a product changes (count and last update), so a cached vocabulary knows when to be rebuilt. */
    String catalogVersion();
    boolean published(UUID productId);
    /** A published product by its slug, with its gallery, where it sits in the catalog, availability and products shown next to it. */
    java.util.Optional<ProductDetail.Facts> detail(String slug, int related);
    /** Most ordered published products (with a photo and in stock), one per category for variety, plus the size of the published catalog. Aggregates only. */
    Highlights highlights(int bestSellers);
    /** Published products changed after `since` (all of them when null), oldest change first, for the search index. */
    FeedPage feed(java.time.Instant since, int page);
}

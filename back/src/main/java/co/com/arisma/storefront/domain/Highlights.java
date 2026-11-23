package co.com.arisma.storefront.domain;
import java.util.List;

/** What the home page shows off: the published products shoppers order the most and how big the catalog is. */
public record Highlights(List<CatalogProduct> bestSellers, long productCount) {
    public static final int BEST_SELLERS = 8;
}

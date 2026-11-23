package co.com.arisma.storefront.domain;
import java.util.List;

/** A page of results. `correctedQuery` is the text actually searched when the shopper's had spelling mistakes; null otherwise. */
public record CatalogPage(List<CatalogProduct> items, long total, int page, int pageSize, String correctedQuery) {
    public CatalogPage(List<CatalogProduct> items, long total, int page, int pageSize) { this(items, total, page, pageSize, null); }
    public CatalogPage corrected(String text) { return new CatalogPage(items, total, page, pageSize, text); }
}

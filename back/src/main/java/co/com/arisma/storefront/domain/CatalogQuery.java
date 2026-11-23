package co.com.arisma.storefront.domain;
import java.util.Locale;

/**
 * What a shopper asked the catalog for, already normalised: blank text is "no filter", pages start at 1. `exact`: search the
 * text as written, without spelling correction.
 */
public record CatalogQuery(String text, String categorySlug, Sort sort, boolean onlyOffers, boolean onlyPriced, int page, boolean exact) {
    public static final int PAGE_SIZE = 24;
    public enum Sort { DESTACADOS, NOVEDADES, PRECIO_ASC, PRECIO_DESC;
        public static Sort parse(String value) {
            if (value == null || value.isBlank()) return DESTACADOS;
            try { return valueOf(value.trim().replace('-', '_').toUpperCase(Locale.ROOT)); } catch (IllegalArgumentException e) { return DESTACADOS; }
        }
    }
    public CatalogQuery {
        text = text == null ? "" : text.trim();
        if (text.length() > 80) text = text.substring(0, 80);
        categorySlug = categorySlug == null ? "" : categorySlug.trim();
        sort = sort == null ? Sort.DESTACADOS : sort;
        page = Math.max(1, page);
    }
    public CatalogQuery withText(String other) { return new CatalogQuery(other, categorySlug, sort, onlyOffers, onlyPriced, page, exact); }
    public int offset() { return (page - 1) * PAGE_SIZE; }
}

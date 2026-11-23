package co.com.arisma.storefront.domain;
import co.com.arisma.shared.domain.Pricing;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * A published product as shown in the store. Prices include tax; both are null when the product hides its price,
 * and salePrice is only set while the sale is running.
 */
public record CatalogProduct(UUID id, String title, String slug, BigDecimal price, BigDecimal salePrice, boolean quoteOnly,
                             boolean inStock, boolean featured, UUID imageId, String imageUrl, boolean imageUploaded) {
    public static CatalogProduct of(UUID id, String title, String slug, BigDecimal regular, BigDecimal sale, Instant saleStarts, Instant saleEnds,
                                    BigDecimal taxPercent, boolean hidePrice, boolean quoteOnly, String stockStatus, boolean featured,
                                    UUID imageId, String imageUrl, boolean imageUploaded, Instant now) {
        boolean showPrice = !hidePrice && regular != null;
        BigDecimal price = showPrice ? Pricing.withTax(regular, taxPercent) : null;
        BigDecimal onSale = showPrice && Pricing.saleActive(sale, saleStarts, saleEnds, now) ? Pricing.withTax(sale, taxPercent) : null;
        return new CatalogProduct(id, title, slug, price, onSale, quoteOnly, !"outofstock".equals(stockStatus), featured, imageId, imageUrl, imageUploaded);
    }
}

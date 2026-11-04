package co.com.arisma.catalog.domain;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/** Catalog product. regularPrice and salePrice are tax-exclusive; taxRateId points to a configurable tax rate. */
public record Product(UUID id, String title, String slug, Status status, String sku, BigDecimal regularPrice, BigDecimal salePrice, Instant saleStartsAt, Instant saleEndsAt,
                      UUID taxRateId, boolean manageStock, Integer stockQuantity, StockStatus stockStatus, Backorders backorders, boolean quoteOnly, boolean hidePrice, boolean featured) {
    public enum Status { DRAFT, PUBLISHED, ARCHIVED }
    public enum StockStatus { INSTOCK, OUTOFSTOCK, ONBACKORDER }
    public enum Backorders { NO, NOTIFY, YES }
    public Product {
        if (id == null || title == null || title.isBlank() || slug == null || slug.isBlank() || status == null) throw new IllegalArgumentException("El identificador, nombre, slug y estado son obligatorios");
        if (regularPrice != null && regularPrice.signum() < 0) throw new IllegalArgumentException("El precio no puede ser negativo");
        if (salePrice != null && salePrice.signum() < 0) throw new IllegalArgumentException("El precio de oferta no puede ser negativo");
        if (salePrice != null && regularPrice == null) throw new IllegalArgumentException("Define el precio normal antes de la oferta");
        if (salePrice != null && salePrice.compareTo(regularPrice) > 0) throw new IllegalArgumentException("La oferta no puede ser mayor que el precio normal");
        if (saleStartsAt != null && saleEndsAt != null && !saleStartsAt.isBefore(saleEndsAt)) throw new IllegalArgumentException("La oferta debe terminar después de empezar");
        if (stockQuantity != null && stockQuantity < 0) throw new IllegalArgumentException("El inventario no puede ser negativo");
        if (status == Status.PUBLISHED && regularPrice == null && !quoteOnly) throw new IllegalArgumentException("Un producto publicado necesita precio o ser solo de cotización");
        if (stockStatus == null) stockStatus = StockStatus.INSTOCK;
        if (backorders == null) backorders = Backorders.NO;
        if (!manageStock) stockQuantity = null;
    }
}

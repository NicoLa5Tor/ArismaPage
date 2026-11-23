package co.com.arisma.catalog.adapter;
import co.com.arisma.catalog.application.SellableProducts;
import co.com.arisma.catalog.domain.PageSections;
import co.com.arisma.shared.adapter.Jdbc;
import co.com.arisma.shared.domain.Availability;
import co.com.arisma.shared.domain.Pricing;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import javax.sql.DataSource;
import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;

@ApplicationScoped
public class PostgresSellableProducts implements SellableProducts {
    @Inject DataSource db;

    public Map<UUID, Sellable> find(Collection<UUID> productIds) {
        if (productIds == null || productIds.isEmpty()) return Map.of();
        return Jdbc.with(db, c -> {
            var out = new HashMap<UUID, Sellable>();
            var sql = "SELECT p.id, p.slug, p.title, p.sku, p.regular_price, p.sale_price, p.sale_starts_at, p.sale_ends_at, t.percent, p.hide_price, p.quote_only, p.manage_stock, p.stock_quantity, p.stock_status, p.backorders,"
                + " p.sold_individually, p.page_sections->>'buy' AS buy, cv.image_id, cv.original_url, COALESCE(cv.uploaded,false) AS uploaded"
                + " FROM product p LEFT JOIN tax_rate t ON t.id=p.tax_rate_id LEFT JOIN v_product_cover cv ON cv.product_id=p.id WHERE p.status='published' AND p.id = ANY(?)";
            try (var s = c.prepareStatement(sql)) {
                s.setArray(1, c.createArrayOf("uuid", productIds.toArray()));
                var now = Instant.now();
                try (var r = s.executeQuery()) {
                    while (r.next()) {
                        BigDecimal regular = r.getBigDecimal(5), sale = r.getBigDecimal(6);
                        boolean priced = !r.getBoolean(10) && !r.getBoolean(11) && regular != null;
                        boolean onSale = priced && Pricing.saleActive(sale, instant(r.getTimestamp(7)), instant(r.getTimestamp(8)), now);
                        int quantity = r.getInt(13); Integer stock = r.wasNull() ? null : quantity;
                        var availability = Availability.of(r.getBoolean(12), stock, r.getString(14), r.getString(15), r.getBoolean(16));
                        PageSections.Visibility buy;
                        try { buy = PageSections.Visibility.parse(r.getString(17)); } catch (IllegalArgumentException e) { buy = PageSections.Visibility.INHERIT; }
                        UUID id = (UUID) r.getObject(1);
                        out.put(id, new Sellable(id, r.getString(2), r.getString(3), r.getString(4), priced ? (onSale ? sale : regular) : null, onSale, r.getBigDecimal(9),
                            availability, buy, (UUID) r.getObject(18), r.getString(19), r.getBoolean(20)));
                    }
                }
            }
            return out;
        });
    }
    public boolean published(UUID productId) { return Jdbc.with(db, c -> Jdbc.one(c, "SELECT 1 FROM product WHERE id=? AND status='published'", productId).isPresent()); }
    private static Instant instant(Timestamp t) { return t == null ? null : t.toInstant(); }
}

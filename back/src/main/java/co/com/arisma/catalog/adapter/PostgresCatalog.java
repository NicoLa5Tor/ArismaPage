package co.com.arisma.catalog.adapter;
import co.com.arisma.catalog.application.ProductRepository;
import co.com.arisma.shared.domain.Pricing;
import co.com.arisma.catalog.domain.Product;
import co.com.arisma.shared.adapter.Jdbc;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import javax.sql.DataSource;
import java.math.BigDecimal;
import java.sql.*;
import java.time.Instant;
import java.util.*;

@ApplicationScoped
public class PostgresCatalog implements ProductRepository {
    private static final String COLUMNS = "p.id,p.title,p.slug,p.status,p.sku,p.regular_price,p.sale_price,p.sale_starts_at,p.sale_ends_at,p.tax_rate_id,p.manage_stock,p.stock_quantity,p.stock_status,p.backorders,p.quote_only,p.hide_price,p.featured,t.percent,COALESCE(s.units,0),cv.image_id,cv.original_url";
    private static final String FROM = " FROM product p LEFT JOIN tax_rate t ON t.id=p.tax_rate_id LEFT JOIN v_product_sales s ON s.product_id=p.id LEFT JOIN v_product_cover cv ON cv.product_id=p.id";
    @Inject DataSource db;

    public List<ProductView> search(String query, Product.Status status, int limit, int offset) {
        String q=query == null ? "" : query.trim(), st=status == null ? "" : status.name().toLowerCase(Locale.ROOT);
        return Jdbc.with(db,c -> { try(var s=c.prepareStatement("SELECT "+COLUMNS+FROM+" WHERE (?='' OR p.title ILIKE ? OR p.sku ILIKE ?) AND (?='' OR p.status=?) ORDER BY p.title,p.id LIMIT ? OFFSET ?")) {
            s.setString(1,q); s.setString(2,"%"+q+"%"); s.setString(3,"%"+q+"%"); s.setString(4,st); s.setString(5,st); s.setInt(6,Math.clamp(limit,1,100)); s.setInt(7,Math.max(0,offset));
            try(var r=s.executeQuery()) { var result=new ArrayList<ProductView>(); while(r.next()) result.add(read(r)); return result; }
        } });
    }
    public Optional<ProductView> view(UUID id) {
        return Jdbc.with(db,c -> { try(var s=c.prepareStatement("SELECT "+COLUMNS+FROM+" WHERE p.id=?")) { s.setObject(1,id); try(var r=s.executeQuery()) { return r.next()?Optional.of(read(r)):Optional.<ProductView>empty(); } } });
    }
    public Optional<Stock> lockStock(UUID id) { return Jdbc.with(db,c -> Jdbc.one(c,"SELECT stock_quantity FROM product WHERE id=? FOR UPDATE",id).map(r -> new Stock((Integer)r.get("stockQuantity")))); }
    public boolean taxRateActive(UUID id) { return Jdbc.with(db,c -> Jdbc.one(c,"SELECT 1 FROM tax_rate WHERE id=? AND active",id).isPresent()); }
    public void upsert(Product p) {
        try { Jdbc.with(db,c -> {
            // price_cop is deprecated and mirrors regular_price until a later migration removes it.
            try(var s=c.prepareStatement("INSERT INTO product(id,title,slug,status,sku,price_cop,regular_price,sale_price,sale_starts_at,sale_ends_at,tax_rate_id,manage_stock,stock_quantity,stock_status,backorders,quote_only,hide_price,featured) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) "
                + "ON CONFLICT(id) DO UPDATE SET title=excluded.title,slug=excluded.slug,status=excluded.status,sku=excluded.sku,price_cop=excluded.price_cop,regular_price=excluded.regular_price,sale_price=excluded.sale_price,sale_starts_at=excluded.sale_starts_at,sale_ends_at=excluded.sale_ends_at,tax_rate_id=excluded.tax_rate_id,"
                + "manage_stock=excluded.manage_stock,stock_quantity=excluded.stock_quantity,stock_status=excluded.stock_status,backorders=excluded.backorders,quote_only=excluded.quote_only,hide_price=excluded.hide_price,featured=excluded.featured,updated_at=now()")) {
                int i=1; s.setObject(i++,p.id()); s.setString(i++,p.title().trim()); s.setString(i++,p.slug().trim()); s.setString(i++,p.status().name().toLowerCase(Locale.ROOT)); s.setString(i++,p.sku()==null || p.sku().isBlank()?null:p.sku().trim());
                s.setBigDecimal(i++,p.regularPrice()); s.setBigDecimal(i++,p.regularPrice()); s.setBigDecimal(i++,p.salePrice()); s.setTimestamp(i++,ts(p.saleStartsAt())); s.setTimestamp(i++,ts(p.saleEndsAt())); s.setObject(i++,p.taxRateId());
                s.setBoolean(i++,p.manageStock()); s.setObject(i++,p.stockQuantity()); s.setString(i++,p.stockStatus().name().toLowerCase(Locale.ROOT)); s.setString(i++,p.backorders().name().toLowerCase(Locale.ROOT)); s.setBoolean(i++,p.quoteOnly()); s.setBoolean(i++,p.hidePrice()); s.setBoolean(i,p.featured());
                return s.executeUpdate();
            } }); }
        catch(IllegalStateException e) { if(Jdbc.duplicate(e)) throw new co.com.arisma.shared.domain.Conflict("Ya existe un producto con ese slug o SKU"); throw e; }
    }
    private ProductView read(ResultSet r) throws SQLException {
        var p=new Product((UUID)r.getObject(1),r.getString(2),r.getString(3),Product.Status.valueOf(r.getString(4).toUpperCase(Locale.ROOT)),r.getString(5),r.getBigDecimal(6),r.getBigDecimal(7),instant(r,8),instant(r,9),
            (UUID)r.getObject(10),r.getBoolean(11),(Integer)r.getObject(12),Product.StockStatus.valueOf(r.getString(13).toUpperCase(Locale.ROOT)),Product.Backorders.valueOf(r.getString(14).toUpperCase(Locale.ROOT)),r.getBoolean(15),r.getBoolean(16),r.getBoolean(17));
        BigDecimal tax=r.getBigDecimal(18);
        return new ProductView(p,tax,Pricing.withTax(p.regularPrice(),tax),Pricing.withTax(p.salePrice(),tax),Pricing.saleActive(p.salePrice(),p.saleStartsAt(),p.saleEndsAt(),Instant.now()),r.getLong(19),(UUID)r.getObject(20),r.getString(21));
    }
    private static Instant instant(ResultSet r, int i) throws SQLException { var t=r.getTimestamp(i); return t==null?null:t.toInstant(); }
    private static Timestamp ts(Instant i) { return i==null?null:Timestamp.from(i); }
}

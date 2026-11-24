package dev.nortech.norpress.storefront.adapter;
import dev.nortech.norpress.shared.domain.Availability;
import dev.nortech.norpress.shared.adapter.Jdbc;
import dev.nortech.norpress.storefront.application.PublicCatalog;
import dev.nortech.norpress.storefront.domain.*;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import javax.sql.DataSource;
import java.sql.*;
import java.time.Instant;
import java.util.*;

@ApplicationScoped
public class PostgresPublicCatalog implements PublicCatalog {
    private static final String SALE_ACTIVE = "(p.sale_price IS NOT NULL AND (p.sale_starts_at IS NULL OR p.sale_starts_at<=now()) AND (p.sale_ends_at IS NULL OR p.sale_ends_at>now()))";
    /** Tax-inclusive price the shopper pays now; null when the price is hidden. */
    private static final String SHOWN_PRICE = "(CASE WHEN p.hide_price OR p.regular_price IS NULL THEN NULL ELSE (CASE WHEN " + SALE_ACTIVE + " THEN p.sale_price ELSE p.regular_price END)*(1+COALESCE(t.percent,0)/100) END)";
    private static final String FROM = " FROM product p LEFT JOIN tax_rate t ON t.id=p.tax_rate_id LEFT JOIN v_product_cover cv ON cv.product_id=p.id";
    /** A category slug matches its own products and those of every subcategory below it. */
    private static final String IN_CATEGORY = "p.id IN (SELECT pc.product_id FROM product_category pc WHERE pc.category_id IN ("
        + "WITH RECURSIVE sub AS (SELECT id FROM category WHERE slug=? UNION ALL SELECT c.id FROM category c JOIN sub ON c.parent_id=sub.id) SELECT id FROM sub))";
    /** Accent- and case-insensitive text: "titere" finds "Títere" without needing the unaccent extension. */
    private static final String FOLD = "translate(lower(%s),'áéíóúüñàèìòù','aeiouunaeiou')";
    @Inject DataSource db;

    public List<CatalogCategory> categories() {
        return Jdbc.with(db, c -> {
            var sql = "WITH RECURSIVE tree AS (SELECT id AS root, id FROM category UNION ALL SELECT t.root, c.id FROM category c JOIN tree t ON c.parent_id=t.id), "
                + "counts AS (SELECT t.root, count(DISTINCT p.id) n FROM tree t JOIN product_category pc ON pc.category_id=t.id JOIN product p ON p.id=pc.product_id AND p.status='published' GROUP BY t.root) "
                + "SELECT c.id,c.name,c.slug,c.parent_id,COALESCE(n.n,0),ARRAY(SELECT k.keyword FROM category_keyword k WHERE k.category_id=c.id ORDER BY k.keyword),c.age_min,c.age_max FROM category c LEFT JOIN counts n ON n.root=c.id ORDER BY c.name";
            try (var s = c.prepareStatement(sql); var r = s.executeQuery()) {
                var out = new ArrayList<CatalogCategory>();
                while (r.next()) out.add(new CatalogCategory((UUID) r.getObject(1), r.getString(2), r.getString(3), (UUID) r.getObject(4), r.getLong(5), List.of((String[]) r.getArray(6).getArray()), number(r, 7), number(r, 8)));
                return out;
            }
        });
    }

    public CatalogPage products(CatalogQuery q) {
        var where = new StringBuilder(" WHERE p.status='published'");
        var params = new ArrayList<Object>();
        // every word must be in the title, in any order: "rompecabezas madera" finds "Rompecabezas en madera"
        var searched = SpellCorrector.searchWords(q.text());
        for (var word : searched.isEmpty() ? (q.text().isEmpty() ? List.<String>of() : List.of(q.text())) : searched.subList(0, Math.min(8, searched.size()))) {
            where.append(" AND ").append(FOLD.formatted("p.title")).append(" LIKE ").append(FOLD.formatted("?")); params.add("%" + word.replace("%", "").replace("_", "") + "%");
        }
        if (!q.categorySlug().isEmpty()) { where.append(" AND ").append(IN_CATEGORY); params.add(q.categorySlug()); }
        if (q.onlyOffers()) where.append(" AND NOT p.hide_price AND ").append(SALE_ACTIVE);
        if (q.onlyPriced()) where.append(" AND NOT p.hide_price AND NOT p.quote_only AND p.regular_price IS NOT NULL");
        String order = switch (q.sort()) {
            case NOVEDADES -> " ORDER BY p.created_at DESC, p.id";
            case PRECIO_ASC -> " ORDER BY " + SHOWN_PRICE + " ASC NULLS LAST, p.title";
            case PRECIO_DESC -> " ORDER BY " + SHOWN_PRICE + " DESC NULLS LAST, p.title";
            // featured first, then products with a photo and a price, so the first screen sells
            case DESTACADOS -> " ORDER BY p.featured DESC, (cv.image_id IS NULL), (" + SHOWN_PRICE + " IS NULL), p.title";
        };
        return Jdbc.with(db, c -> {
            long total;
            try (var s = c.prepareStatement("SELECT count(*)" + FROM + where)) {
                bind(s, params); try (var r = s.executeQuery()) { r.next(); total = r.getLong(1); }
            }
            var sql = "SELECT p.id,p.title,p.slug,p.regular_price,p.sale_price,p.sale_starts_at,p.sale_ends_at,t.percent,p.hide_price,p.quote_only,p.stock_status,p.featured,cv.image_id,cv.original_url,COALESCE(cv.uploaded,false)"
                + FROM + where + order + " LIMIT ? OFFSET ?";
            try (var s = c.prepareStatement(sql)) {
                var all = new ArrayList<>(params); all.add(CatalogQuery.PAGE_SIZE); all.add(q.offset()); bind(s, all);
                var now = Instant.now(); var items = new ArrayList<CatalogProduct>();
                try (var r = s.executeQuery()) {
                    while (r.next()) items.add(CatalogProduct.of((UUID) r.getObject(1), r.getString(2), r.getString(3), r.getBigDecimal(4), r.getBigDecimal(5), instant(r, 6), instant(r, 7),
                        r.getBigDecimal(8), r.getBoolean(9), r.getBoolean(10), r.getString(11), r.getBoolean(12), (UUID) r.getObject(13), r.getString(14), r.getBoolean(15), now));
                }
                return new CatalogPage(items, total, q.page(), CatalogQuery.PAGE_SIZE);
            }
        });
    }

    public Map<String, Integer> vocabulary() {
        return Jdbc.with(db, c -> {
            var sql = "SELECT w, count(*) FROM (SELECT regexp_split_to_table(" + FOLD.formatted("title") + ", '[^a-z0-9]+') w FROM product WHERE status='published'"
                + " UNION ALL SELECT regexp_split_to_table(" + FOLD.formatted("name") + ", '[^a-z0-9]+') FROM category) x WHERE length(w)>=3 GROUP BY w";
            try (var s = c.prepareStatement(sql); var r = s.executeQuery()) {
                var out = new HashMap<String, Integer>();
                while (r.next()) out.put(r.getString(1), r.getInt(2));
                return out;
            }
        });
    }

    public String catalogVersion() {
        return Jdbc.with(db, c -> {
            try (var s = c.prepareStatement("SELECT (SELECT count(*) FROM product)||':'||COALESCE((SELECT max(updated_at)::text FROM product),'')||':'||(SELECT count(*) FROM category)"); var r = s.executeQuery()) { r.next(); return r.getString(1); }
        });
    }

    public Highlights highlights(int bestSellers) {
        return Jdbc.with(db, c -> {
            long count;
            try (var s = c.prepareStatement("SELECT count(*) FROM product WHERE status='published'"); var r = s.executeQuery()) { r.next(); count = r.getLong(1); }
            // ranked by how many paid orders include the product, so one bulk purchase does not outrank a steady seller
            var sql = "SELECT p.id,p.title,p.slug,p.regular_price,p.sale_price,p.sale_starts_at,p.sale_ends_at,t.percent,p.hide_price,p.quote_only,p.stock_status,p.featured,cv.image_id,cv.original_url,COALESCE(cv.uploaded,false),"
                + "ARRAY(SELECT pc.category_id::text FROM product_category pc JOIN category k ON k.id=pc.category_id WHERE pc.product_id=p.id AND k.slug<>'uncategorized')"
                + FROM + " JOIN (SELECT l.product_id, count(DISTINCT l.order_id) n FROM order_line l JOIN sales_order o ON o.id=l.order_id AND o.status IN ('completed','processing') GROUP BY l.product_id) sold ON sold.product_id=p.id"
                + " WHERE p.status='published' AND cv.image_id IS NOT NULL AND p.stock_status<>'outofstock' ORDER BY sold.n DESC, p.title LIMIT ?";
            try (var s = c.prepareStatement(sql)) {
                s.setInt(1, bestSellers * 12);
                var now = Instant.now(); var items = new ArrayList<CatalogProduct>(); var spare = new ArrayList<CatalogProduct>(); var seen = new HashSet<String>();
                try (var r = s.executeQuery()) {
                    while (r.next() && items.size() < bestSellers) {
                        var product = CatalogProduct.of((UUID) r.getObject(1), r.getString(2), r.getString(3), r.getBigDecimal(4), r.getBigDecimal(5), instant(r, 6), instant(r, 7),
                            r.getBigDecimal(8), r.getBoolean(9), r.getBoolean(10), r.getString(11), r.getBoolean(12), (UUID) r.getObject(13), r.getString(14), r.getBoolean(15), now);
                        // variety: only the best seller of each category makes the list, so one product line cannot fill it
                        var categories = List.of((String[]) r.getArray(16).getArray());
                        if (Collections.disjoint(seen, categories)) { items.add(product); seen.addAll(categories); } else spare.add(product);
                    }
                }
                for (var product : spare) { if (items.size() >= bestSellers) break; items.add(product); }
                return new Highlights(items, count);
            }
        });
    }

    public FeedPage feed(Instant since, int page) {
        return Jdbc.with(db, c -> {
            var where = since == null ? "" : " AND p.updated_at > ?";
            var sql = "SELECT p.id,p.title,p.slug,p.regular_price,p.sale_price,p.sale_starts_at,p.sale_ends_at,t.percent,p.hide_price,p.quote_only,p.stock_status,p.featured,cv.image_id,cv.original_url,COALESCE(cv.uploaded,false),p.description_html,p.updated_at,"
                + "ARRAY(SELECT pk.keyword FROM product_keyword pk WHERE pk.product_id=p.id),p.age_min,p.age_max"
                + FROM + " WHERE p.status='published'" + where + " ORDER BY p.updated_at, p.id LIMIT ? OFFSET ?";
            var rows = new ArrayList<FeedProduct>();
            var ids = new ArrayList<UUID>();
            var now = Instant.now();
            var raw = new ArrayList<Object[]>();
            try (var s = c.prepareStatement(sql)) {
                int i = 1;
                if (since != null) s.setTimestamp(i++, Timestamp.from(since));
                s.setInt(i++, FeedPage.PAGE_SIZE + 1); s.setInt(i, (page - 1) * FeedPage.PAGE_SIZE);
                try (var r = s.executeQuery()) {
                    while (r.next()) {
                        var product = CatalogProduct.of((UUID) r.getObject(1), r.getString(2), r.getString(3), r.getBigDecimal(4), r.getBigDecimal(5), instant(r, 6), instant(r, 7),
                            r.getBigDecimal(8), r.getBoolean(9), r.getBoolean(10), r.getString(11), r.getBoolean(12), (UUID) r.getObject(13), r.getString(14), r.getBoolean(15), now);
                        raw.add(new Object[]{product, PlainText.of(r.getString(16)), instant(r, 17), List.of((String[]) r.getArray(18).getArray()), number(r, 19), number(r, 20)});
                    }
                }
            }
            boolean hasMore = raw.size() > FeedPage.PAGE_SIZE;
            if (hasMore) raw.remove(raw.size() - 1);
            for (var row : raw) ids.add(((CatalogProduct) row[0]).id());
            var names = new HashMap<UUID, List<String>>(); var slugs = new HashMap<UUID, List<String>>();
            // what a product takes from its categories: their keywords and the span of the ages they state
            var inherited = new HashMap<UUID, List<String>>(); var ages = new HashMap<UUID, Integer[]>();
            if (!ids.isEmpty()) {
                // every category of the product plus all of its ancestors, so "Matemáticas" also matches "Ciencias y tecnología"
                var cats = "WITH RECURSIVE up AS (SELECT pc.product_id, c.id, c.name, c.slug, c.parent_id, c.age_min, c.age_max FROM product_category pc JOIN category c ON c.id=pc.category_id WHERE pc.product_id = ANY(?) "
                    + "UNION SELECT up.product_id, k.id, k.name, k.slug, k.parent_id, k.age_min, k.age_max FROM up JOIN category k ON k.id=up.parent_id) "
                    + "SELECT up.product_id, array_agg(DISTINCT up.name), array_agg(DISTINCT up.slug), "
                    + "COALESCE(array_agg(DISTINCT w.keyword) FILTER (WHERE w.keyword IS NOT NULL), '{}'), min(up.age_min), max(up.age_max) "
                    + "FROM up LEFT JOIN category_keyword w ON w.category_id=up.id WHERE up.slug <> 'uncategorized' GROUP BY up.product_id";
                try (var s = c.prepareStatement(cats)) {
                    s.setArray(1, c.createArrayOf("uuid", ids.toArray()));
                    try (var r = s.executeQuery()) {
                        while (r.next()) {
                            var id = (UUID) r.getObject(1);
                            names.put(id, List.of((String[]) r.getArray(2).getArray()));
                            slugs.put(id, List.of((String[]) r.getArray(3).getArray()));
                            inherited.put(id, List.of((String[]) r.getArray(4).getArray()));
                            ages.put(id, new Integer[]{number(r, 5), number(r, 6)});
                        }
                    }
                }
            }
            for (var row : raw) {
                var product = (CatalogProduct) row[0];
                @SuppressWarnings("unchecked") var keywords = new LinkedHashSet<>((List<String>) row[3]);
                keywords.addAll(inherited.getOrDefault(product.id(), List.of()));
                // the product's own age range wins; without one it takes the span of its categories
                var span = row[4] != null ? new Integer[]{(Integer) row[4], (Integer) row[5]} : ages.getOrDefault(product.id(), new Integer[]{null, null});
                rows.add(new FeedProduct(product, (String) row[1], names.getOrDefault(product.id(), List.of()), slugs.getOrDefault(product.id(), List.of()), List.copyOf(keywords), span[0], span[1], (Instant) row[2]));
            }
            var removed = new ArrayList<UUID>();
            if (since != null && page == 1) {
                try (var s = c.prepareStatement("SELECT id FROM product WHERE status<>'published' AND updated_at > ?")) {
                    s.setTimestamp(1, Timestamp.from(since));
                    try (var r = s.executeQuery()) { while (r.next()) removed.add((UUID) r.getObject(1)); }
                }
            }
            return new FeedPage(rows, removed, page, hasMore);
        });
    }

    private static final String CARD = "p.id,p.title,p.slug,p.regular_price,p.sale_price,p.sale_starts_at,p.sale_ends_at,t.percent,p.hide_price,p.quote_only,p.stock_status,p.featured,cv.image_id,cv.original_url,COALESCE(cv.uploaded,false)";
    private static CatalogProduct card(ResultSet r, Instant now) throws SQLException {
        return CatalogProduct.of((UUID) r.getObject(1), r.getString(2), r.getString(3), r.getBigDecimal(4), r.getBigDecimal(5), instant(r, 6), instant(r, 7),
            r.getBigDecimal(8), r.getBoolean(9), r.getBoolean(10), r.getString(11), r.getBoolean(12), (UUID) r.getObject(13), r.getString(14), r.getBoolean(15), now);
    }

    public Optional<ProductDetail.Facts> detail(String slug, int related) {
        return Jdbc.with(db, c -> {
            var now = Instant.now();
            CatalogProduct product; String sku; Integer ownMin, ownMax; Availability availability;
            try (var s = c.prepareStatement("SELECT " + CARD + ",p.sku,p.manage_stock,p.stock_quantity,p.backorders,p.sold_individually,p.age_min,p.age_max" + FROM + " WHERE p.slug=? AND p.status='published'")) {
                s.setString(1, slug);
                try (var r = s.executeQuery()) {
                    if (!r.next()) return Optional.<ProductDetail.Facts>empty();
                    availability = Availability.of(r.getBoolean(17), number(r, 18), r.getString(11), r.getString(19), r.getBoolean(20));
                    var card = card(r, now);
                    // the card says "in stock" from the stored status alone; tracked stock that ran out must not
                    product = new CatalogProduct(card.id(), card.title(), card.slug(), card.price(), card.salePrice(), card.quoteOnly(), availability.purchasable(), card.featured(), card.imageId(), card.imageUrl(), card.imageUploaded());
                    sku = r.getString(16); ownMin = number(r, 21); ownMax = number(r, 22);
                }
            }
            var images = new ArrayList<ProductDetail.Image>();
            for (var row : Jdbc.list(c, "SELECT id, original_url, object_key IS NOT NULL AS uploaded, alt FROM product_image WHERE product_id=? ORDER BY is_primary DESC, position, id", product.id()))
                images.add(new ProductDetail.Image((UUID) row.get("id"), (String) row.get("originalUrl"), (Boolean) row.get("uploaded"), (String) row.get("alt")));

            // every category of the product with its ancestors; "leaf" says which of the product's categories each row climbs from
            var rows = Jdbc.list(c, "WITH RECURSIVE up AS (SELECT c.id, c.name, c.slug, c.parent_id, c.age_min, c.age_max, c.id AS leaf, 0 AS hops FROM product_category pc JOIN category c ON c.id=pc.category_id WHERE pc.product_id=? "
                + "UNION ALL SELECT k.id, k.name, k.slug, k.parent_id, k.age_min, k.age_max, up.leaf, up.hops+1 FROM up JOIN category k ON k.id=up.parent_id WHERE up.hops < 12) "
                + "SELECT name, slug, age_min, age_max, leaf, hops FROM up WHERE slug <> 'uncategorized' ORDER BY leaf, hops", product.id());
            var chains = new LinkedHashMap<UUID, List<ProductDetail.Crumb>>();
            Integer low = null, high = null;
            for (var row : rows) {
                chains.computeIfAbsent((UUID) row.get("leaf"), k -> new ArrayList<>()).add(new ProductDetail.Crumb((String) row.get("name"), (String) row.get("slug")));
                if (row.get("ageMin") != null) { int min = ((Number) row.get("ageMin")).intValue(), max = ((Number) row.get("ageMax")).intValue(); low = low == null ? min : Math.min(low, min); high = high == null ? max : Math.max(high, max); }
            }
            // the trail is the deepest path, main category first; the product's own categories are the start of each chain
            List<ProductDetail.Crumb> trail = new ArrayList<>(chains.values().stream().max(Comparator.comparingInt(List::size)).orElse(List.of()));
            Collections.reverse(trail);
            var categories = chains.values().stream().map(chain -> chain.get(0)).toList();

            var others = new ArrayList<CatalogProduct>();
            if (related > 0) {
                var sql = "SELECT " + CARD + FROM + " JOIN (SELECT pc2.product_id, count(*) AS shared FROM product_category pc1 JOIN category k ON k.id=pc1.category_id AND k.slug<>'uncategorized' "
                    + "JOIN product_category pc2 ON pc2.category_id=pc1.category_id WHERE pc1.product_id=? AND pc2.product_id<>? GROUP BY pc2.product_id) near ON near.product_id=p.id "
                    + "LEFT JOIN v_product_sales sold ON sold.product_id=p.id WHERE p.status='published' AND cv.image_id IS NOT NULL AND p.stock_status<>'outofstock' "
                    + "ORDER BY near.shared DESC, COALESCE(sold.orders,0) DESC, p.title LIMIT ?";
                try (var s = c.prepareStatement(sql)) {
                    s.setObject(1, product.id()); s.setObject(2, product.id()); s.setInt(3, related);
                    try (var r = s.executeQuery()) { while (r.next()) others.add(card(r, now)); }
                }
            }
            return Optional.of(new ProductDetail.Facts(product, sku, images, trail, categories, ownMin != null ? ownMin : low, ownMin != null ? ownMax : high, availability, others));
        });
    }

    public boolean published(UUID productId) {
        return Jdbc.with(db, c -> Jdbc.one(c, "SELECT 1 FROM product WHERE id=? AND status='published'", productId).isPresent());
    }

    private static void bind(PreparedStatement s, List<Object> params) throws SQLException { for (int i = 0; i < params.size(); i++) s.setObject(i + 1, params.get(i)); }
    private static Integer number(ResultSet r, int i) throws SQLException { int value = r.getInt(i); return r.wasNull() ? null : value; }
    private static Instant instant(ResultSet r, int i) throws SQLException { var t = r.getTimestamp(i); return t == null ? null : t.toInstant(); }
}

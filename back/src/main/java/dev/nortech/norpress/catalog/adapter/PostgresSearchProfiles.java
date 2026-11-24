package dev.nortech.norpress.catalog.adapter;
import dev.nortech.norpress.catalog.application.SearchProfileRepository;
import dev.nortech.norpress.catalog.domain.SearchProfile;
import dev.nortech.norpress.shared.adapter.Jdbc;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.*;

@ApplicationScoped
public class PostgresSearchProfiles implements SearchProfileRepository {
    /** A category and everything below it. */
    private static final String SUBTREE = "WITH RECURSIVE sub AS (SELECT id FROM category WHERE id=? UNION ALL SELECT c.id FROM category c JOIN sub ON c.parent_id=sub.id) ";
    /** A product's categories and every ancestor of each. */
    private static final String ANCESTRY = "WITH RECURSIVE up AS (SELECT c.id, c.parent_id, c.age_min, c.age_max FROM product_category pc JOIN category c ON c.id=pc.category_id WHERE pc.product_id=? "
        + "UNION SELECT k.id, k.parent_id, k.age_min, k.age_max FROM up JOIN category k ON k.id=up.parent_id) ";
    @Inject DataSource db;

    public Optional<SearchProfile> ofCategory(UUID id) {
        return Jdbc.with(db, c -> {
            var row = Jdbc.one(c, "SELECT age_min, age_max FROM category WHERE id=?", id);
            if (row.isEmpty()) return Optional.<SearchProfile>empty();
            return Optional.of(new SearchProfile(keywords(c, "SELECT keyword FROM category_keyword WHERE category_id=? ORDER BY keyword", id), number(row.get().get("ageMin")), number(row.get().get("ageMax"))));
        });
    }

    public Optional<ProductProfile> ofProduct(UUID id) {
        return Jdbc.with(db, c -> {
            var row = Jdbc.one(c, "SELECT age_min, age_max FROM product WHERE id=?", id);
            if (row.isEmpty()) return Optional.<ProductProfile>empty();
            var own = new SearchProfile(keywords(c, "SELECT keyword FROM product_keyword WHERE product_id=? ORDER BY keyword", id), number(row.get().get("ageMin")), number(row.get().get("ageMax")));
            var inherited = keywords(c, ANCESTRY + "SELECT DISTINCT k.keyword FROM up JOIN category_keyword k ON k.category_id=up.id ORDER BY k.keyword", id);
            var ages = Jdbc.one(c, ANCESTRY + "SELECT min(age_min) AS low, max(age_max) AS high FROM up", id).orElseThrow();
            return Optional.of(new ProductProfile(own, inherited, number(ages.get("low")), number(ages.get("high"))));
        });
    }

    public boolean replaceForCategory(UUID id, SearchProfile profile) {
        return Jdbc.with(db, c -> {
            if (Jdbc.update(c, "UPDATE category SET age_min=?, age_max=? WHERE id=?", profile.ageMin(), profile.ageMax(), id) == 0) return false;
            Jdbc.update(c, "DELETE FROM category_keyword WHERE category_id=?", id);
            insert(c, "INSERT INTO category_keyword(category_id, keyword) VALUES (?,?)", id, profile.keywords());
            // the search index picks up changed products by updated_at
            Jdbc.update(c, SUBTREE + "UPDATE product SET updated_at=now() WHERE id IN (SELECT pc.product_id FROM product_category pc WHERE pc.category_id IN (SELECT id FROM sub))", id);
            return true;
        });
    }

    public boolean replaceForProduct(UUID id, SearchProfile profile) {
        return Jdbc.with(db, c -> {
            if (Jdbc.update(c, "UPDATE product SET age_min=?, age_max=?, updated_at=now() WHERE id=?", profile.ageMin(), profile.ageMax(), id) == 0) return false;
            Jdbc.update(c, "DELETE FROM product_keyword WHERE product_id=?", id);
            insert(c, "INSERT INTO product_keyword(product_id, keyword) VALUES (?,?)", id, profile.keywords());
            return true;
        });
    }

    private static void insert(Connection c, String sql, UUID owner, List<String> keywords) throws SQLException {
        if (keywords.isEmpty()) return;
        try (var s = c.prepareStatement(sql)) {
            for (String keyword : keywords) { s.setObject(1, owner); s.setString(2, keyword); s.addBatch(); }
            s.executeBatch();
        }
    }
    private static List<String> keywords(Connection c, String sql, UUID id) throws SQLException {
        var out = new ArrayList<String>();
        for (var row : Jdbc.list(c, sql, id)) out.add((String) row.get("keyword"));
        return out;
    }
    private static Integer number(Object value) { return value == null ? null : ((Number) value).intValue(); }
}

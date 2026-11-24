package dev.nortech.norpress.catalog.adapter;
import dev.nortech.norpress.catalog.application.ProductPageRepository;
import dev.nortech.norpress.catalog.domain.PageSections;
import dev.nortech.norpress.catalog.domain.ProductPage;
import dev.nortech.norpress.shared.adapter.Jdbc;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import javax.sql.DataSource;
import java.util.*;

@ApplicationScoped
public class PostgresProductPages implements ProductPageRepository {
    private static final ObjectMapper JSON = new ObjectMapper();
    @Inject DataSource db;

    public Optional<ProductPage> find(UUID productId) {
        return Jdbc.with(db, c -> Jdbc.one(c, "SELECT short_description, description_html, highlights, specs, page_sections FROM product WHERE id=?", productId).map(PostgresProductPages::read));
    }

    public boolean replace(UUID productId, ProductPage page) {
        var specs = page.specs().stream().map(spec -> Map.of("label", spec.label(), "value", spec.value())).toList();
        return Jdbc.with(db, c -> Jdbc.update(c, "UPDATE product SET short_description=?, description_html=?, highlights=?::jsonb, specs=?::jsonb, page_sections=?::jsonb, updated_at=now() WHERE id=?",
            page.shortDescription(), page.descriptionHtml(), json(page.highlights()), json(specs), json(page.sections().toKeys()), productId) > 0);
    }

    /**
     * Rows written by hand or by an older version are read leniently: an entry that no longer passes the rules is left
     * out instead of making the product impossible to open.
     */
    static ProductPage read(Map<String, Object> row) {
        var highlights = new ArrayList<String>();
        for (JsonNode item : array(row.get("highlights"))) if (item.isTextual() && item.asText().length() <= ProductPage.MAX_HIGHLIGHT && highlights.size() < ProductPage.MAX_HIGHLIGHTS) highlights.add(item.asText());
        var specs = new ArrayList<ProductPage.Spec>(); var labels = new HashSet<String>();
        for (JsonNode item : array(row.get("specs"))) {
            if (specs.size() >= ProductPage.MAX_SPECS) break;
            try { var spec = new ProductPage.Spec(item.path("label").asText(""), item.path("value").asText("")); if (labels.add(spec.label().toLowerCase(Locale.ROOT))) specs.add(spec); }
            catch (IllegalArgumentException ignored) { /* skip the broken row */ }
        }
        var choices = new LinkedHashMap<String, String>();
        if (row.get("pageSections") instanceof JsonNode sections && sections.isObject()) sections.fields().forEachRemaining(e -> choices.put(e.getKey(), e.getValue().asText("")));
        PageSections sections;
        try { sections = PageSections.parse(choices); } catch (IllegalArgumentException e) { sections = PageSections.INHERIT_ALL; }
        String summary = Objects.toString(row.get("shortDescription"), "").replaceAll("<[^>]*>", " ").trim();
        String description = Objects.toString(row.get("descriptionHtml"), "");
        if (summary.length() > ProductPage.MAX_SHORT) summary = summary.substring(0, ProductPage.MAX_SHORT);
        return new ProductPage(summary, description.length() > ProductPage.MAX_DESCRIPTION ? description.substring(0, ProductPage.MAX_DESCRIPTION) : description, highlights, specs, sections);
    }
    private static Iterable<JsonNode> array(Object value) { return value instanceof JsonNode node && node.isArray() ? node : List.of(); }
    private static String json(Object value) {
        try { return JSON.writeValueAsString(value); } catch (JsonProcessingException e) { throw new IllegalStateException(e); }
    }
}

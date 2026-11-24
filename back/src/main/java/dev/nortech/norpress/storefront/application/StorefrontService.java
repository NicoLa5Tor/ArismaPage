package dev.nortech.norpress.storefront.application;
import dev.nortech.norpress.shared.domain.Availability;
import dev.nortech.norpress.catalog.application.ProductPageService;
import dev.nortech.norpress.catalog.domain.PageSections;
import dev.nortech.norpress.catalog.domain.PageSections.Section;
import dev.nortech.norpress.media.application.ImageService;
import dev.nortech.norpress.media.application.ObjectStore;
import dev.nortech.norpress.shared.domain.NotFound;
import dev.nortech.norpress.storefront.domain.*;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Public store use cases: browse categories and products, open a product page, and fetch the photos of published products. */
@ApplicationScoped
public class StorefrontService {
    static final int RELATED = 8;
    @Inject PublicCatalog catalog;
    @Inject ImageService images;
    @Inject ProductPageService pages;
    @Inject dev.nortech.norpress.settings.application.StoreSettingsService settings;
    @Inject dev.nortech.norpress.reviews.application.ReviewService reviews;

    public List<CatalogCategory> categories() { return catalog.categories(); }
    /** Searches what the shopper meant: words the catalog does not use are corrected to the ones it does, unless the search is exact. */
    public CatalogPage products(CatalogQuery query) {
        if (query.exact() || query.text().isEmpty()) return catalog.products(query);
        var correction = corrector().correct(query.text());
        if (!correction.changed()) return catalog.products(query);
        return catalog.products(query.withText(correction.text())).corrected(correction.text());
    }

    private static final long VERSION_CHECK_MS = 60_000;
    private record Vocabulary(String version, SpellCorrector corrector, long checkedAt) {}
    private volatile Vocabulary vocabulary;

    /** The corrector over the current catalog words, rebuilt when the catalog changed; the change is looked for at most once a minute. */
    SpellCorrector corrector() {
        var current = vocabulary;
        long now = System.currentTimeMillis();
        if (current != null && now - current.checkedAt() < VERSION_CHECK_MS) return current.corrector();
        var version = catalog.catalogVersion();
        var corrector = current != null && current.version().equals(version) ? current.corrector() : new SpellCorrector(catalog.vocabulary());
        vocabulary = new Vocabulary(version, corrector, now);
        return corrector;
    }
    public Highlights highlights() { return catalog.highlights(Highlights.BEST_SELLERS); }
    public FeedPage feed(java.time.Instant since, int page) { return catalog.feed(since, Math.max(1, page)); }

    /** The product page. Content of a hidden section is left out of the answer, and the description is the cleaned one. */
    public ProductDetail product(String slug) {
        if (slug == null || slug.isBlank() || slug.length() > 200) throw new NotFound("Producto no encontrado");
        var facts = catalog.detail(slug.trim(), RELATED).orElseThrow(() -> new NotFound("Producto no encontrado"));
        var page = pages.of(facts.product().id());
        var shown = new java.util.LinkedHashMap<>(page.sections().resolve(settings.pageSections()));
        // a conversation the store switched off is off for every product, whatever the product says
        var talk = settings.conversations();
        shown.computeIfPresent(Section.REVIEWS.key(), (key, on) -> on && talk.reviews());
        shown.computeIfPresent(Section.QUESTIONS.key(), (key, on) -> on && talk.questions());
        var stock = facts.availability();
        boolean age = on(shown, Section.AGE);
        return new ProductDetail(facts.product(), on(shown, Section.SKU) ? facts.sku() : null, page.shortDescription(),
            on(shown, Section.DESCRIPTION) ? page.descriptionHtml() : "",
            on(shown, Section.HIGHLIGHTS) ? page.highlights() : List.of(),
            on(shown, Section.SPECS) ? page.specs().stream().map(spec -> new ProductDetail.Spec(spec.label(), spec.value())).toList() : List.of(),
            facts.images(), facts.breadcrumbs(), on(shown, Section.CATEGORIES) ? facts.categories() : List.of(),
            age ? facts.ageMin() : null, age ? facts.ageMax() : null,
            on(shown, Section.STOCK) ? stock : new Availability(stock.status(), null, stock.maxQuantity()),
            shown, rating(facts.product().id(), on(shown, Section.REVIEWS)), on(shown, Section.RELATED) ? facts.related() : List.of());
    }
    private ProductDetail.Rating rating(UUID productId, boolean shown) {
        if (!shown) return ProductDetail.Rating.NONE;
        var summary = reviews.summary(productId);
        return new ProductDetail.Rating(summary.average(), summary.count());
    }
    private static boolean on(Map<String, Boolean> shown, Section section) { return shown.getOrDefault(section.key(), true); }

    public ObjectStore.StoredObject image(UUID productId, UUID imageId) {
        if (!catalog.published(productId)) throw new NotFound("Imagen no encontrada");
        return images.content(productId, imageId);
    }
}

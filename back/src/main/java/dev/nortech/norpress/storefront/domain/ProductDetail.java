package dev.nortech.norpress.storefront.domain;
import dev.nortech.norpress.shared.domain.Availability;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Everything the public product page shows. `sections` is already resolved (product choice, else store default), and
 * content the page hides is not sent at all, so hiding a section also keeps it out of the page source.
 */
public record ProductDetail(CatalogProduct product, String sku, String shortDescription, String descriptionHtml, List<String> highlights, List<Spec> specs,
                            List<Image> images, List<Crumb> breadcrumbs, List<Crumb> categories, Integer ageMin, Integer ageMax,
                            Availability availability, Map<String, Boolean> sections, Rating rating, List<CatalogProduct> related) {
    public record Spec(String label, String value) {}
    /** A gallery photo: uploaded ones are served by the public image route, historical ones from their original address. */
    public record Image(UUID id, String url, boolean uploaded, String alt) {}
    /** A category on the way to the product, from the main one down. */
    public record Crumb(String name, String slug) {}
    public record Rating(double average, long count) {
        public static final Rating NONE = new Rating(0, 0);
    }

    /** What the catalog itself knows about the product; the page content and the section choices are added by the application. */
    public record Facts(CatalogProduct product, String sku, List<Image> images, List<Crumb> breadcrumbs, List<Crumb> categories, Integer ageMin, Integer ageMax,
                        Availability availability, List<CatalogProduct> related) {}
}

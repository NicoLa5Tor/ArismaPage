package dev.nortech.norpress.storefront.domain;
import java.util.List;
import java.util.UUID;

/**
 * A store category as the public sees it: productCount counts published products in it and in its subcategories.
 * keywords are other words shoppers use for it; the age range, when set, is who its products are for.
 */
public record CatalogCategory(UUID id, String name, String slug, UUID parentId, long productCount, List<String> keywords, Integer ageMin, Integer ageMax) {}

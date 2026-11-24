package dev.nortech.norpress.catalog.application;
import dev.nortech.norpress.catalog.domain.SearchProfile;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Persistence port for search profiles. Writes run inside the caller's transaction. */
public interface SearchProfileRepository {
    /** A product's own profile plus what it takes from its categories and their ancestors (read-only for the panel). */
    record ProductProfile(@com.fasterxml.jackson.annotation.JsonUnwrapped SearchProfile own, List<String> inheritedKeywords, Integer inheritedAgeMin, Integer inheritedAgeMax) {}

    /** Empty when the category does not exist. */
    Optional<SearchProfile> ofCategory(UUID categoryId);
    Optional<ProductProfile> ofProduct(UUID productId);
    /** Replaces the profile and marks every product in the category and its subcategories as changed, so the search index picks them up. False when the category does not exist. */
    boolean replaceForCategory(UUID categoryId, SearchProfile profile);
    /** Replaces the profile and marks the product as changed. False when the product does not exist. */
    boolean replaceForProduct(UUID productId, SearchProfile profile);
}

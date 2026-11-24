package dev.nortech.norpress.storefront.domain;
import java.time.Instant;
import java.util.List;

/**
 * A published product as the search index needs it: the shop card plus plain-text description and every category it
 * sits under. keywords are its own plus those of its categories and their ancestors; the age range is its own when
 * set, otherwise the span of the ones its categories state.
 */
public record FeedProduct(CatalogProduct product, String description, List<String> categories, List<String> categorySlugs, List<String> keywords, Integer ageMin, Integer ageMax, Instant updatedAt) {}

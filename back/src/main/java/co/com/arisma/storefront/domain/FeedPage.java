package co.com.arisma.storefront.domain;
import java.util.List;
import java.util.UUID;

/** One page of the search feed. `removed` lists products changed since the cursor that are no longer published (ids only). */
public record FeedPage(List<FeedProduct> items, List<UUID> removed, int page, boolean hasMore) {
    public static final int PAGE_SIZE = 500;
}

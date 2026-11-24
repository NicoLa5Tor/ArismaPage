package dev.nortech.norpress.quotes.application;
import dev.nortech.norpress.quotes.domain.QuoteStatus;
import dev.nortech.norpress.shared.application.Page;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/** Read side of quote requests. */
public interface QuoteQueries {
    Page list(QuoteStatus status, String query, Page.Request page);
    Optional<Map<String, Object>> detail(UUID id);
}

package co.com.arisma.quotes.application;
import co.com.arisma.quotes.domain.QuoteStatus;
import co.com.arisma.shared.application.Page;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/** Read side of quote requests. */
public interface QuoteQueries {
    Page list(QuoteStatus status, String query, Page.Request page);
    Optional<Map<String, Object>> detail(UUID id);
}

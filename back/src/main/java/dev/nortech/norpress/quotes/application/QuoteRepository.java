package dev.nortech.norpress.quotes.application;
import dev.nortech.norpress.quotes.domain.QuoteStatus;
import java.util.Optional;
import java.util.UUID;

/** Write side of quote requests; callers run inside a transaction. */
public interface QuoteRepository {
    Optional<QuoteStatus> lockStatus(UUID id);
    void updateStatus(UUID id, QuoteStatus status);
    void addNote(UUID id, String body, UUID actor);
}

package dev.nortech.norpress.quotes.application;
import dev.nortech.norpress.quotes.domain.QuoteStatus;
import dev.nortech.norpress.shared.domain.NotFound;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import java.util.UUID;

/** Quote use cases: follow-up status with an optional note. */
@ApplicationScoped
public class QuoteService {
    @Inject QuoteRepository quotes;
    @Transactional
    public void changeStatus(UUID id, QuoteStatus next, String note, UUID actor) {
        var current = quotes.lockStatus(id).orElseThrow(() -> new NotFound("Cotización no encontrada"));
        current.requireManualMoveTo(next);
        quotes.updateStatus(id, next);
        if (note != null && !note.isBlank()) {
            if (note.length() > 4000) throw new IllegalArgumentException("La nota admite máximo 4.000 caracteres");
            quotes.addNote(id, note.trim(), actor);
        }
    }
}

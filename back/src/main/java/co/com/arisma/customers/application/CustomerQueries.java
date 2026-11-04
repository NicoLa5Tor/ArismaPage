package co.com.arisma.customers.application;
import co.com.arisma.shared.application.Page;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/** Read side of customers: who buys, how much and what. */
public interface CustomerQueries {
    enum Sort {
        RECENT, SPENT, ORDERS, NAME;
        public static Sort parse(String value) {
            if (value == null || value.isBlank()) return RECENT;
            try { return valueOf(value.trim().toUpperCase(Locale.ROOT)); } catch (IllegalArgumentException e) { throw new IllegalArgumentException("Orden inválido"); }
        }
    }
    /** buyersOnly hides the thousands of accounts that never bought. */
    Page list(String query, boolean buyersOnly, Sort sort, Page.Request page);
    /** Customer with addresses, orders, quotes and most bought products. */
    Optional<Map<String, Object>> detail(UUID id);
}

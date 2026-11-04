package co.com.arisma.catalog.application;
import co.com.arisma.catalog.domain.TaxRate;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

public interface TaxRateRepository {
    record Usage(BigDecimal percent, long products) {}
    /** Rates with how many products use each one. */
    List<Map<String, Object>> list();
    Optional<Map<String, Object>> find(UUID id);
    Optional<Usage> lockUsage(UUID id);
    void insert(TaxRate rate);
    void update(TaxRate rate);
}

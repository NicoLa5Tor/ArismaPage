package co.com.arisma.catalog.application;
import co.com.arisma.catalog.domain.TaxRate;
import co.com.arisma.shared.domain.NotFound;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import java.util.Map;

@ApplicationScoped
public class TaxRateService {
    @Inject TaxRateRepository rates;
    @Transactional
    public Map<String, Object> create(TaxRate rate) { rates.insert(rate); return rates.find(rate.id()).orElseThrow(); }
    @Transactional
    public Map<String, Object> update(TaxRate rate) {
        var usage = rates.lockUsage(rate.id()).orElseThrow(() -> new NotFound("Tasa no encontrada"));
        rate.requireCompatibleWith(usage.percent(), usage.products());
        rates.update(rate);
        return rates.find(rate.id()).orElseThrow();
    }
}

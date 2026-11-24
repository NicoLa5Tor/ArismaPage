package dev.nortech.norpress.catalog.application;
import dev.nortech.norpress.catalog.domain.TaxRate;
import dev.nortech.norpress.shared.domain.NotFound;
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

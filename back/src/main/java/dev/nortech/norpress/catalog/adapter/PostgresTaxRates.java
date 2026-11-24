package dev.nortech.norpress.catalog.adapter;
import dev.nortech.norpress.catalog.application.TaxRateRepository;
import dev.nortech.norpress.catalog.domain.TaxRate;
import dev.nortech.norpress.shared.adapter.Jdbc;
import dev.nortech.norpress.shared.domain.Conflict;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import javax.sql.DataSource;
import java.math.BigDecimal;
import java.util.*;

@ApplicationScoped
public class PostgresTaxRates implements TaxRateRepository {
    private static final String SELECT = "SELECT t.id,t.code,t.name,t.percent,t.active,(SELECT count(*) FROM product p WHERE p.tax_rate_id=t.id) AS products FROM tax_rate t";
    @Inject DataSource db;
    public List<Map<String,Object>> list() { return Jdbc.with(db,c -> Jdbc.list(c,SELECT+" ORDER BY t.percent DESC,t.name")); }
    public Optional<Map<String,Object>> find(UUID id) { return Jdbc.with(db,c -> Jdbc.one(c,SELECT+" WHERE t.id=?",id)); }
    public Optional<Usage> lockUsage(UUID id) {
        return Jdbc.with(db,c -> Jdbc.one(c,"SELECT t.percent,(SELECT count(*) FROM product p WHERE p.tax_rate_id=t.id) AS n FROM tax_rate t WHERE t.id=? FOR UPDATE",id).map(r -> new Usage((BigDecimal)r.get("percent"),((Number)r.get("n")).longValue())));
    }
    public void insert(TaxRate r) { write("INSERT INTO tax_rate(code,name,percent,active,id) VALUES(?,?,?,?,?)",r); }
    public void update(TaxRate r) { write("UPDATE tax_rate SET code=?,name=?,percent=?,active=? WHERE id=?",r); }
    private void write(String sql, TaxRate r) {
        try { Jdbc.with(db,c -> Jdbc.update(c,sql,r.code(),r.name(),r.percent(),r.active(),r.id())); }
        catch(IllegalStateException e) { if(Jdbc.duplicate(e)) throw new Conflict("Ya existe una tasa con ese código"); throw e; }
    }
}

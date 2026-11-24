package dev.nortech.norpress.fulfillment.adapter;
import dev.nortech.norpress.fulfillment.application.FulfillmentPorts.CarrierCatalog;
import dev.nortech.norpress.fulfillment.domain.Carrier;
import dev.nortech.norpress.shared.adapter.Jdbc;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import javax.sql.DataSource;
import java.util.*;

@ApplicationScoped
public class PostgresCarriers implements CarrierCatalog {
    private static final String COLUMNS = "SELECT code,name,array_to_string(aliases,'|') AS aliases,tracking_key,link_template,page_url,number_hint,active,position FROM carrier ";
    @Inject DataSource db;

    public List<Carrier> all() { return Jdbc.with(db, c -> Jdbc.list(c, COLUMNS + "ORDER BY position, name").stream().map(PostgresCarriers::carrier).toList()); }
    public Optional<Carrier> find(String code) { return Jdbc.with(db, c -> Jdbc.one(c, COLUMNS + "WHERE code=?", code == null ? "" : code.trim().toLowerCase(Locale.ROOT)).map(PostgresCarriers::carrier)); }
    public void save(Carrier k) {
        Jdbc.with(db, c -> Jdbc.update(c, "INSERT INTO carrier(code,name,aliases,tracking_key,link_template,page_url,number_hint,active,position) VALUES(?,?,string_to_array(?,'|'),?,?,?,?,?,?)"
            + " ON CONFLICT (code) DO UPDATE SET name=excluded.name,aliases=excluded.aliases,tracking_key=excluded.tracking_key,link_template=excluded.link_template,page_url=excluded.page_url,"
            + "number_hint=excluded.number_hint,active=excluded.active,position=excluded.position,updated_at=now()",
            k.code(), k.name(), String.join("|", k.aliases()), k.trackingKey(), k.linkTemplate(), k.pageUrl(), k.numberHint(), k.active(), k.position()));
    }

    private static Carrier carrier(Map<String, Object> r) {
        String aliases = (String) r.get("aliases");
        return new Carrier((String) r.get("code"), (String) r.get("name"), aliases == null || aliases.isEmpty() ? List.of() : List.of(aliases.split("\\|")),
            r.get("trackingKey") == null ? null : ((Number) r.get("trackingKey")).intValue(), (String) r.get("linkTemplate"), (String) r.get("pageUrl"),
            (String) r.get("numberHint"), Boolean.TRUE.equals(r.get("active")), ((Number) r.get("position")).intValue());
    }
}

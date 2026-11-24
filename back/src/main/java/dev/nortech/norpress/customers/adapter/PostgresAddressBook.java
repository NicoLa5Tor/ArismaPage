package dev.nortech.norpress.customers.adapter;
import dev.nortech.norpress.customers.application.ShopperPorts.AddressBook;
import dev.nortech.norpress.customers.application.ShopperPorts.Places;
import dev.nortech.norpress.customers.application.ShopperPorts.Profiles;
import dev.nortech.norpress.customers.domain.Address;
import dev.nortech.norpress.customers.domain.Profile;
import dev.nortech.norpress.shared.adapter.Jdbc;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import javax.sql.DataSource;
import java.util.*;

@ApplicationScoped
public class PostgresAddressBook implements AddressBook, Profiles, Places {
    private static final String COLUMNS = "SELECT id,label,recipient,phone,state,city,neighborhood,street,detail,instructions,is_default FROM customer_address ";
    @Inject DataSource db;

    public List<Address> list(UUID customerId) {
        return Jdbc.with(db, c -> Jdbc.list(c, COLUMNS + "WHERE customer_id=? ORDER BY is_default DESC, created_at DESC", customerId).stream().map(PostgresAddressBook::address).toList());
    }
    public Optional<Address> find(UUID customerId, UUID addressId) {
        return Jdbc.with(db, c -> Jdbc.one(c, COLUMNS + "WHERE customer_id=? AND id=?", customerId, addressId).map(PostgresAddressBook::address));
    }
    public int count(UUID customerId) { return Jdbc.with(db, c -> Jdbc.count(c, "SELECT count(*) FROM customer_address WHERE customer_id=?", customerId)).intValue(); }

    public Address save(UUID customerId, Address a, boolean asDefault) {
        return Jdbc.with(db, c -> {
            if (asDefault) Jdbc.update(c, "UPDATE customer_address SET is_default=false WHERE customer_id=? AND is_default", customerId);
            UUID id = a.id() == null ? UUID.randomUUID() : a.id();
            if (a.id() == null) Jdbc.update(c, "INSERT INTO customer_address(id,customer_id,label,recipient,phone,state,city,neighborhood,street,detail,instructions,is_default) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
                id, customerId, a.label().db(), a.recipient(), a.phone(), a.state(), a.city(), a.neighborhood(), a.street(), a.detail(), a.instructions(), asDefault);
            else Jdbc.update(c, "UPDATE customer_address SET label=?,recipient=?,phone=?,state=?,city=?,neighborhood=?,street=?,detail=?,instructions=?,is_default=(is_default OR ?),updated_at=now() WHERE id=? AND customer_id=?",
                a.label().db(), a.recipient(), a.phone(), a.state(), a.city(), a.neighborhood(), a.street(), a.detail(), a.instructions(), asDefault, id, customerId);
            return Jdbc.one(c, COLUMNS + "WHERE id=?", id).map(PostgresAddressBook::address).orElseThrow();
        });
    }
    public boolean delete(UUID customerId, UUID addressId) {
        return Jdbc.with(db, c -> {
            var gone = Jdbc.one(c, "DELETE FROM customer_address WHERE id=? AND customer_id=? RETURNING is_default", addressId, customerId);
            if (gone.isEmpty()) return false;
            if (Boolean.TRUE.equals(gone.get().get("isDefault")))
                Jdbc.update(c, "UPDATE customer_address SET is_default=true WHERE id=(SELECT id FROM customer_address WHERE customer_id=? ORDER BY created_at DESC LIMIT 1)", customerId);
            return true;
        });
    }
    public boolean makeDefault(UUID customerId, UUID addressId) {
        return Jdbc.with(db, c -> {
            if (Jdbc.one(c, "SELECT 1 FROM customer_address WHERE id=? AND customer_id=?", addressId, customerId).isEmpty()) return false;
            Jdbc.update(c, "UPDATE customer_address SET is_default=false WHERE customer_id=? AND is_default", customerId);
            Jdbc.update(c, "UPDATE customer_address SET is_default=true, updated_at=now() WHERE id=?", addressId);
            return true;
        });
    }

    public Profile get(UUID customerId) {
        return Jdbc.with(db, c -> Jdbc.one(c, "SELECT first_name,last_name,COALESCE(phone,'') AS phone,COALESCE(document_type,'') AS document_type,COALESCE(document_number,'') AS document_number,COALESCE(company,'') AS company FROM customer WHERE id=?", customerId)
            .map(r -> new Profile((String) r.get("firstName"), (String) r.get("lastName"), (String) r.get("phone"), (String) r.get("documentType"), (String) r.get("documentNumber"), (String) r.get("company")))
            .orElse(new Profile("", "", "", "", "", "")));
    }
    public void save(UUID customerId, Profile p) {
        Jdbc.with(db, c -> Jdbc.update(c, "UPDATE customer SET first_name=?,last_name=?,phone=?,document_type=?,document_number=?,company=NULLIF(?,''),updated_at=now() WHERE id=?",
            p.firstName(), p.lastName(), p.phone(), p.documentType(), p.documentNumber(), p.company(), customerId));
    }

    public List<String> cities(String state, int limit) {
        // the department's official municipalities (DANE, table municipality), alphabetically
        return Jdbc.with(db, c -> Jdbc.list(c, "SELECT name FROM municipality WHERE state=? ORDER BY name COLLATE \"C\" LIMIT ?", state, limit).stream().map(r -> (String) r.get("name")).toList());
    }

    public Optional<String> municipality(String state, String name) {
        // accents and case do not matter: "bogota, d. c." and "Bogotá, D. C." are the same place
        String fold = "translate(lower(%s),'áéíóúüñ','aeiouun')";
        // "Bogotá" also names "Bogotá, D. C.": the part before the comma is enough
        String given = name == null ? "" : name.trim();
        return Jdbc.with(db, c -> Jdbc.one(c, "SELECT name FROM municipality WHERE state=? AND (" + fold.formatted("name") + "=" + fold.formatted("?")
            + " OR " + fold.formatted("split_part(name, ',', 1)") + "=" + fold.formatted("?") + ") ORDER BY length(name) LIMIT 1", state, given, given)
            .map(r -> (String) r.get("name")));
    }

    private static Address address(Map<String, Object> r) {
        return new Address((UUID) r.get("id"), Address.Label.parse((String) r.get("label")), (String) r.get("recipient"), (String) r.get("phone"), (String) r.get("state"), (String) r.get("city"),
            (String) r.get("neighborhood"), (String) r.get("street"), (String) r.get("detail"), (String) r.get("instructions"), Boolean.TRUE.equals(r.get("isDefault")));
    }
}

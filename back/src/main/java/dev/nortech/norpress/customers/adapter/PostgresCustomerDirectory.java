package dev.nortech.norpress.customers.adapter;
import dev.nortech.norpress.customers.application.CustomerDirectory;
import dev.nortech.norpress.shared.adapter.Jdbc;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import javax.sql.DataSource;
import java.util.UUID;

@ApplicationScoped
public class PostgresCustomerDirectory implements CustomerDirectory {
    @Inject DataSource db;
    public UUID ensure(String email, String firstName, String lastName, String phone, String documentType, String documentNumber, String company) {
        return Jdbc.with(db, c -> {
            var found = Jdbc.one(c, "SELECT id FROM customer WHERE lower(email)=lower(?) FOR UPDATE", email);
            if (found.isPresent()) {
                UUID id = (UUID) found.get().get("id");
                Jdbc.update(c, "UPDATE customer SET first_name=COALESCE(NULLIF(first_name,''),?), last_name=COALESCE(NULLIF(last_name,''),?), phone=COALESCE(NULLIF(phone,''),?), document_type=COALESCE(NULLIF(document_type,''),?),"
                    + " document_number=COALESCE(NULLIF(document_number,''),?), company=COALESCE(NULLIF(company,''),NULLIF(?,'')), updated_at=now() WHERE id=?", firstName, lastName, phone, documentType, documentNumber, company, id);
                return id;
            }
            UUID id = UUID.randomUUID();
            Jdbc.update(c, "INSERT INTO customer(id,email,first_name,last_name,phone,document_type,document_number,company) VALUES(?,?,?,?,?,?,?,NULLIF(?,''))", id, email, firstName, lastName, phone, documentType, documentNumber, company);
            return id;
        });
    }
}

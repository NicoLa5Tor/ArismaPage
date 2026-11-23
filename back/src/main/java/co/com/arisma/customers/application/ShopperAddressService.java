package co.com.arisma.customers.application;
import co.com.arisma.customers.application.ShopperPorts.*;
import co.com.arisma.customers.domain.Address;
import co.com.arisma.customers.domain.Profile;
import co.com.arisma.shared.domain.NotFound;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * The signed-in shopper's address book and own data, Mercado Libre style. Everything is scoped to the session's
 * customer: an address of another customer is never found, so it can be neither read, changed nor used to buy.
 */
@ApplicationScoped
public class ShopperAddressService {
    private static final Pattern STATE = Pattern.compile("CO-[A-Z]{2,3}");
    @Inject AddressBook book;
    @Inject Profiles profiles;
    @Inject Places places;

    public List<Address> addresses(Shopper shopper) { return book.list(shopper.customerId()); }

    /** The address to deliver an order to. NotFound when it is not one of this customer's. */
    public Address address(Shopper shopper, UUID addressId) {
        if (addressId == null) throw new IllegalArgumentException("Elige la dirección de entrega");
        return book.find(shopper.customerId(), addressId).orElseThrow(() -> new NotFound("No encontramos esa dirección en tu cuenta"));
    }

    /** New (id null) or changed address. The first one, or one asked to be, becomes the default. */
    @Transactional
    public Address save(Shopper shopper, UUID id, Address address, boolean asDefault) {
        UUID customer = shopper.customerId();
        if (id != null && book.find(customer, id).isEmpty()) throw new NotFound("No encontramos esa dirección en tu cuenta");
        // the municipality must be one of the department's official ones; it is stored with its official name
        String city = places.municipality(address.state(), address.city()).orElseThrow(() -> new IllegalArgumentException("Elige el municipio de la lista del departamento"));
        address = new Address(address.id(), address.label(), address.recipient(), address.phone(), address.state(), city, address.neighborhood(), address.street(), address.detail(), address.instructions(), address.isDefault());
        int count = book.count(customer);
        if (id == null && count >= Address.MAX_PER_CUSTOMER) throw new IllegalArgumentException("Puedes guardar hasta " + Address.MAX_PER_CUSTOMER + " direcciones; elimina una que ya no uses");
        return book.save(customer, address.withId(id, false), asDefault || count == 0);
    }

    @Transactional
    public void delete(Shopper shopper, UUID id) {
        if (!book.delete(shopper.customerId(), id)) throw new NotFound("No encontramos esa dirección en tu cuenta");
    }

    @Transactional
    public void makeDefault(Shopper shopper, UUID id) {
        if (!book.makeDefault(shopper.customerId(), id)) throw new NotFound("No encontramos esa dirección en tu cuenta");
    }

    public Profile profile(Shopper shopper) { return profiles.get(shopper.customerId()); }

    @Transactional
    public Profile saveProfile(Shopper shopper, Profile profile) {
        var valid = profile.validated();
        profiles.save(shopper.customerId(), valid);
        return valid;
    }

    /** The department's official municipalities, for the address form's list. */
    public List<String> cities(String state) {
        String code = state == null ? "" : state.trim().toUpperCase(Locale.ROOT);
        return STATE.matcher(code).matches() ? places.cities(code, 200) : List.of();
    }
}

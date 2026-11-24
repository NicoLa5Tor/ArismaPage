package dev.nortech.norpress.customers.application;

import dev.nortech.norpress.customers.application.ShopperPorts.Shopper;
import dev.nortech.norpress.customers.domain.Address;
import dev.nortech.norpress.shared.domain.NotFound;
import org.junit.jupiter.api.Test;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

class ShopperAddressServiceTest {
    /** An address book in memory, scoped by customer like the real one. */
    static class Book implements ShopperPorts.AddressBook {
        final Map<UUID, Map<UUID, Address>> byCustomer = new HashMap<>();
        Map<UUID, Address> of(UUID c) { return byCustomer.computeIfAbsent(c, k -> new LinkedHashMap<>()); }
        public List<Address> list(UUID c) { return List.copyOf(of(c).values()); }
        public Optional<Address> find(UUID c, UUID id) { return Optional.ofNullable(of(c).get(id)); }
        public int count(UUID c) { return of(c).size(); }
        public Address save(UUID c, Address a, boolean asDefault) {
            if (asDefault) of(c).replaceAll((k, v) -> v.withId(k, false));
            UUID id = a.id() == null ? UUID.randomUUID() : a.id();
            boolean wasDefault = a.id() != null && of(c).get(id).isDefault();
            var stored = a.withId(id, asDefault || wasDefault);
            of(c).put(id, stored);
            return stored;
        }
        public boolean delete(UUID c, UUID id) { return of(c).remove(id) != null; }
        public boolean makeDefault(UUID c, UUID id) { if (!of(c).containsKey(id)) return false; of(c).replaceAll((k, v) -> v.withId(k, k.equals(id))); return true; }
    }

    private final Book book = new Book();
    private final ShopperAddressService service = new ShopperAddressService();
    { service.book = book; service.places = new ShopperPorts.Places() {
        public List<String> cities(String state, int limit) { return List.of("Bogotá, D. C."); }
        public Optional<String> municipality(String state, String name) { return "CO-DC".equals(state) && name.toLowerCase(Locale.ROOT).startsWith("bogot") ? Optional.of("Bogotá, D. C.") : Optional.empty(); }
    }; }
    private static Shopper shopper() { return new Shopper(UUID.randomUUID(), UUID.randomUUID(), "Ana Rojas", "ana@example.com", true); }
    private static Address home(String street) { return new Address(null, Address.Label.CASA, "Ana Rojas", "3108669112", "CO-DC", "Bogotá", "Chapinero", street, "", "", false); }

    @Test void theFirstAddressIsTheDefault() {
        var ana = shopper();
        var first = service.save(ana, null, home("Calle 53 # 15-24"), false);
        var second = service.save(ana, null, home("Carrera 7 # 70-10"), false);
        assertTrue(first.isDefault());
        assertFalse(second.isDefault());
        service.makeDefault(ana, second.id());
        assertTrue(book.find(ana.customerId(), second.id()).orElseThrow().isDefault());
        assertFalse(book.find(ana.customerId(), first.id()).orElseThrow().isDefault());
    }

    @Test void nobodyReadsChangesOrBuysWithAnotherCustomersAddress() {
        var ana = shopper();
        var luis = shopper();
        var hers = service.save(ana, null, home("Calle 53 # 15-24"), false);
        assertThrows(NotFound.class, () -> service.address(luis, hers.id()));
        assertThrows(NotFound.class, () -> service.save(luis, hers.id(), home("Calle 1 # 1-1"), false));
        assertThrows(NotFound.class, () -> service.delete(luis, hers.id()));
        assertThrows(NotFound.class, () -> service.makeDefault(luis, hers.id()));
        assertEquals("Calle 53 # 15-24", service.address(ana, hers.id()).street());
    }

    @Test void theMunicipalityMustBeAnOfficialOneOfTheDepartment() {
        var ana = shopper();
        assertEquals("Bogotá, D. C.", service.save(ana, null, home("Calle 53 # 15-24"), false).city(), "stored with its official name");
        var nowhere = new Address(null, Address.Label.CASA, "Ana Rojas", "3108669112", "CO-DC", "Ciudad Gótica", "", "Calle 1 # 2-3", "", "", false);
        assertThrows(IllegalArgumentException.class, () -> service.save(ana, null, nowhere, false));
    }

    @Test void theBookHasALimit() {
        var ana = shopper();
        for (int i = 0; i < Address.MAX_PER_CUSTOMER; i++) service.save(ana, null, home("Calle " + (10 + i) + " # 20-30"), false);
        assertThrows(IllegalArgumentException.class, () -> service.save(ana, null, home("Calle 99 # 20-30"), false));
    }
}

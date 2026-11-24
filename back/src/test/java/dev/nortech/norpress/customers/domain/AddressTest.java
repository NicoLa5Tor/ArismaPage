package dev.nortech.norpress.customers.domain;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class AddressTest {
    private Address address(String state, String street, String phone) {
        return new Address(null, Address.Label.parse("trabajo"), "  Ana   María Rojas ", phone, state, "Medellín", "Laureles", street, "Apto 301", "Dejar en portería", false);
    }

    @Test void aCompleteAddressIsCleanedUp() {
        var a = address("co-ant", "Calle 10 # 20-30", "310 866 9112");
        assertEquals("Ana María Rojas", a.recipient());
        assertEquals("CO-ANT", a.state());
        assertEquals("3108669112", a.phone());
        assertEquals(Address.Label.TRABAJO, a.label());
        assertEquals("Ana", a.firstName());
        assertEquals("María Rojas", a.lastName());
    }

    @Test void whatIsMissingOrWrongIsSaidPlainly() {
        assertThrows(IllegalArgumentException.class, () -> address("Antioquia", "Calle 10 # 20-30", "3108669112"));
        assertThrows(IllegalArgumentException.class, () -> address("CO-ANT", "Cll", "3108669112"));
        assertThrows(IllegalArgumentException.class, () -> address("CO-ANT", "Calle 10 # 20-30", "123"));
        assertThrows(IllegalArgumentException.class, () -> address("CO-ANT", "<script>Calle 10</script>", "3108669112"));
        assertThrows(IllegalArgumentException.class, () -> Address.Label.parse("castillo"));
    }

    @Test void optionalPartsMayBeEmpty() {
        var a = new Address(null, null, "Luis Pérez", "3001112233", "CO-DC", "Bogotá", null, "Carrera 15 # 52-10", null, null, false);
        assertEquals("", a.neighborhood());
        assertEquals("", a.detail());
        assertEquals(Address.Label.CASA, a.label());
    }

    @Test void aProfileMustBeCompleteToBuy() {
        var p = new Profile(" Ana ", "Rojas", "310-866-9112", "cc", "1.193.602", "").validated();
        assertEquals("Ana", p.firstName());
        assertEquals("CC", p.documentType());
        assertEquals("3108669112", p.phone());
        assertThrows(IllegalArgumentException.class, () -> new Profile("Ana", "Rojas", "3108669112", "XX", "1193602", "").validated());
        assertThrows(IllegalArgumentException.class, () -> new Profile("A", "Rojas", "3108669112", "CC", "1193602", "").validated());
    }
}

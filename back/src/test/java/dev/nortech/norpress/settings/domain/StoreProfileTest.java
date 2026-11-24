package dev.nortech.norpress.settings.domain;
import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;

class StoreProfileTest {
    static StoreProfile shop(String city, String state) {
        return new StoreProfile("Juguetería Norte", "Norte", "Norte S.A.S.", "900.123.456-7", "Carrera 7 No. 10-20", "local 2", city, state, "+57 300 123 4567", "601 555 0101", "Ventas@Norte.co",
            List.of("Lunes a sábado de 9 a 6", " "), "https://norte.co", "https://norte.co/terminos", "https://norte.co/datos", "#0A7F5A");
    }
    @Test void localAreaIsTheDepartmentOrTheCityHoweverItIsWritten() {
        var p = shop("Medellín", "CO-ANT");
        assertTrue(p.isLocal("Envigado", "CO-ANT"));
        assertTrue(p.isLocal("MEDELLIN", "CO-CUN"));
        assertFalse(p.isLocal("Bogotá", "CO-DC"));
        assertFalse(StoreProfile.DEFAULT.isLocal("Bogotá", "CO-DC"), "a store with no local area charges everyone the national rate");
    }
    @Test void cleansWhatTheAdministratorTypes() {
        var p = shop("Medellín", "co-ant");
        assertEquals("573001234567", p.whatsapp());
        assertEquals("300 123 4567", p.whatsappLabel());
        assertEquals("ventas@norte.co", p.email());
        assertEquals("#0a7f5a", p.color());
        assertEquals("Norte", p.shortName());
        assertEquals("Solo", new StoreProfile("Solo", "", "", "", "", "", "", "", "", "", "", List.of(), "", "", "", "").shortName(), "no short name: the name");
        assertEquals(List.of("Lunes a sábado de 9 a 6"), p.hours());
        assertEquals("Carrera 7 No. 10-20, local 2, Medellín", p.pickupLine());
        assertEquals("Juguetería Norte · Carrera 7 No. 10-20, Medellín · WhatsApp 300 123 4567", p.signature());
    }
    @Test void roundTripsThroughStorage() { var p = shop("Cali", "CO-VAC"); assertEquals(p, StoreProfile.fromMap(p.toMap())); }
    @Test void refusesWhatWouldBreakAPageOrAnEmail() {
        assertThrows(IllegalArgumentException.class, () -> new StoreProfile(" ", "", "", "", "", "", "", "", "", "", "", List.of(), "", "", "", ""));
        assertThrows(IllegalArgumentException.class, () -> new StoreProfile("<b>x</b>", "", "", "", "", "", "", "", "", "", "", List.of(), "", "", "", ""));
        assertThrows(IllegalArgumentException.class, () -> new StoreProfile("X", "", "", "", "", "", "", "", "", "", "", List.of(), "javascript:alert(1)", "", "", ""));
        assertThrows(IllegalArgumentException.class, () -> new StoreProfile("X", "", "", "", "", "", "", "Bogotá", "", "", "", List.of(), "", "", "", ""));
        assertThrows(IllegalArgumentException.class, () -> new StoreProfile("X", "", "", "", "", "", "", "", "", "", "", List.of(), "", "", "", "red"));
    }
    @Test void shippingSavedBeforeTheLocalAreaStillReads() {
        var old = Shipping.fromMap(Map.of("bogotaRate", 11046, "nationalRate", 15000, "freeFromBogota", 150000, "pickup", true, "minimumOrder", 50000));
        assertEquals(new BigDecimal("11046"), old.localRate());
        assertEquals(BigDecimal.ZERO, old.cost(Shipping.Method.LOCAL, new BigDecimal("150000")));
        assertEquals(new BigDecimal("15000"), old.cost(Shipping.Method.NATIONAL, new BigDecimal("150000")));
    }
}

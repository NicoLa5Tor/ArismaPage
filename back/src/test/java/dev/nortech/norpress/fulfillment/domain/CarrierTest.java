package dev.nortech.norpress.fulfillment.domain;

import org.junit.jupiter.api.Test;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

class CarrierTest {
    private static Carrier withLink(String template, String page) { return new Carrier("coordinadora", "Coordinadora", List.of("coordinadora"), 100493, template, page, "", true, 1); }

    @Test void theLinkCarriesTheNumberWhenThePageTakesIt() {
        var c = withLink("https://coordinadora.com/rastreo/?guia={guia}", "https://coordinadora.com/rastreo/");
        assertEquals("https://coordinadora.com/rastreo/?guia=12345678901", c.linkFor("12345678901"));
        assertTrue(c.opensTheGuide());
        assertEquals("https://coordinadora.com/rastreo/?guia=AB+12%2F3", c.linkFor("AB 12/3"), "the number is encoded");
    }

    @Test void otherwiseItIsThePlainTrackingPage() {
        var c = withLink(null, "https://www.interrapidisimo.com/");
        assertEquals("https://www.interrapidisimo.com/", c.linkFor("700123456789"));
        assertFalse(c.opensTheGuide());
    }

    @Test void onlySafeWebAddressesWithOneSlot() {
        assertThrows(IllegalArgumentException.class, () -> withLink("http://inseguro.com/?g={guia}", null));
        assertThrows(IllegalArgumentException.class, () -> withLink("javascript:alert(1)//{guia}", null));
        assertThrows(IllegalArgumentException.class, () -> withLink("https://x.com/?g=sin-hueco", null));
        assertThrows(IllegalArgumentException.class, () -> withLink("https://x.com/{guia}/{guia}", null));
        assertThrows(IllegalArgumentException.class, () -> new Carrier("Con Espacios", "X", List.of(), null, null, null, "", true, 1));
    }

    @Test void namesMatchLooselyAndNumbersAreNormalized() {
        var inter = new Carrier("inter", "Inter Rapidísimo", List.of("inter", "Interrapidisimo"), 100491, null, "https://www.interrapidisimo.com/", "", true, 3);
        assertTrue(inter.matches(" INTER RAPIDÍSIMO "));
        assertTrue(inter.matches("interrapidísimo"));
        assertFalse(inter.matches("Coordinadora"));
        assertEquals("7001-23ABC", Carrier.normalizeNumber(" 7001-23 abc "));
        assertThrows(IllegalArgumentException.class, () -> Carrier.normalizeNumber("12"));
        assertThrows(IllegalArgumentException.class, () -> Carrier.normalizeNumber("guía#123"));
    }
}

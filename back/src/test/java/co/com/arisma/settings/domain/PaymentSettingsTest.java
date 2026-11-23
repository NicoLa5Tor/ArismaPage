package co.com.arisma.settings.domain;
import static org.junit.jupiter.api.Assertions.*;
import java.util.Map;
import org.junit.jupiter.api.Test;

class PaymentSettingsTest {
    static Gateway wompi(boolean test, String prefix) {
        return new Gateway(Gateway.Code.WOMPI, test, Map.of("publicKey", "pub_" + prefix + "_a"), Map.of("privateKey", "prv_" + prefix + "_b", "integritySecret", prefix + "_integrity_c", "eventsSecret", prefix + "_events_d"));
    }
    @Test void onlyACompleteMethodCanBeActive() {
        var settings = new PaymentSettings(Gateway.Code.WOMPI, true);
        assertDoesNotThrow(() -> settings.requireReady(wompi(true, "test")));
        assertThrows(IllegalArgumentException.class, () -> settings.requireReady(new Gateway(Gateway.Code.WOMPI, true, Map.of("publicKey", "pub_test_a"), Map.of())));
        assertThrows(IllegalArgumentException.class, () -> settings.requireReady(null));
        assertDoesNotThrow(() -> PaymentSettings.DEFAULT.requireReady(null), "nothing active is always allowed");
    }
    @Test void wompiKeysMustBelongToTheirEnvironment() {
        assertDoesNotThrow(() -> wompi(true, "test").requireMatchingEnvironment());
        assertThrows(IllegalArgumentException.class, () -> new Gateway(Gateway.Code.WOMPI, true, Map.of("publicKey", "pub_prod_a"), Map.of()).requireMatchingEnvironment());
        assertThrows(IllegalArgumentException.class, () -> new Gateway(Gateway.Code.WOMPI, false, Map.of(), Map.of("integritySecret", "test_integrity_x")).requireMatchingEnvironment());
        assertDoesNotThrow(() -> new Gateway(Gateway.Code.WOMPI, false, Map.of("publicKey", "pub_prod_a"), Map.of("privateKey", "prv_prod_b", "integritySecret", "prod_integrity_c", "eventsSecret", "prod_events_d")).requireMatchingEnvironment());
    }
    @Test void transferHasNoEnvironmentsAndBlankSecretsKeepTheStoredOnes() {
        assertFalse(new Gateway(Gateway.Code.MANUAL, true, Map.of("instructions", "Banco"), Map.of()).test());
        var stored = new Gateway(Gateway.Code.PAYU, true, Map.of("merchantId", "1", "accountId", "2"), Map.of("apiKey", "secreta"));
        var next = stored.merge(Map.of("merchantId", "1", "accountId", "3"), Map.of("apiKey", " "));
        assertEquals("secreta", next.secrets().get("apiKey"));
        assertEquals("3", next.config().get("accountId"));
        assertTrue(next.complete());
    }
    @Test void settingsReadWhatTheyWrite() {
        var settings = new PaymentSettings(Gateway.Code.PAYU, false);
        assertEquals(settings, PaymentSettings.fromMap(settings.toMap()));
        assertEquals(PaymentSettings.DEFAULT, PaymentSettings.fromMap(Map.of("active", "otra")));
        assertTrue(PaymentSettings.DEFAULT.test(), "a fresh store starts in test mode");
    }
}

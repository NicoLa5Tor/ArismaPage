package co.com.arisma.payments.domain;
import static org.junit.jupiter.api.Assertions.*;
import java.util.List;
import org.junit.jupiter.api.Test;

/** Vectors copied from the Wompi and PayU documentation. */
class SignaturesTest {
    static final String PAYU_KEY = "4Vj8eK4rloUd272L48hsrarnUA";

    @Test void wompiIntegrityMatchesTheDocumentedExample() {
        assertEquals("37c8407747e595535433ef8f6a811d853cd943046624a0ec04662b17bbf33bf5", Signatures.wompiIntegrity("sk8-438k4-xmxm392-sn2m", 2490000, "COP", "prod_integrity_Z5mMke9x0k8gpErbDqwrJXMqsI6SFli6"));
    }
    @Test void wompiEventConcatenatesPropertiesTimestampAndSecret() {
        assertEquals(Signatures.hash("SHA-256", "1234-1610641025-49201APPROVED44900001530291411prod_events_x"), Signatures.wompiEvent(List.of("1234-1610641025-49201", "APPROVED", "4490000"), 1530291411L, "prod_events_x"));
    }
    @Test void payuFormBaseStringMatchesTheDocumentedMd5() {
        assertEquals("7ee7cf808ce6a39b17481c54f2c57acc", Signatures.hash("MD5", String.join("~", PAYU_KEY, "508029", "TestPayU", "20000", "COP")));
        assertEquals(Signatures.hash("SHA-256", PAYU_KEY + "~508029~TestPayU~20000~COP"), Signatures.payuForm(PAYU_KEY, "508029", "TestPayU", "20000", "COP"));
    }
    @Test void payuResponseValueRoundsHalfToEven() {
        assertEquals("150.2", Signatures.payuResponseValue("150.25"));
        assertEquals("150.4", Signatures.payuResponseValue("150.35"));
        assertEquals("150.3", Signatures.payuResponseValue("150.34"));
        assertEquals("100.0", Signatures.payuResponseValue("100.00"));
    }
    @Test void payuConfirmationValueDropsATrailingZeroOnly() {
        assertEquals("150.0", Signatures.payuConfirmationValue("150.00"));
        assertEquals("150.25", Signatures.payuConfirmationValue("150.25"));
        assertEquals("150.0", Signatures.payuConfirmationValue("150"));
        assertEquals("75306.0", Signatures.payuConfirmationValue("75306.00"));
    }
    @Test void hmacMatchesTheDocumentedExamples() {
        assertEquals("5ac639cc57ea3ceccef66243f7a20412ea4ae0c86b5121ca6aa67597266057d1", Signatures.hmacSha256("test123", PAYU_KEY + "~508029~PayUTest01~150.2~USD~6"));
        assertEquals("65fb2b3452572784e23e7d6480359fd2507c54dd285ca3c4dceffb8764cfb66f", Signatures.hmacSha256("test123", PAYU_KEY + "~508029~PayUTest01~150.0~USD~4"));
    }
    @Test void payuAcceptsAnyDocumentedAlgorithmAndNothingElse() {
        String base = PAYU_KEY + "~508029~R1~150.0~COP~4";
        for (String algorithm : List.of("MD5", "SHA-1", "SHA-256")) assertTrue(Signatures.payuMatches(Signatures.hash(algorithm, base).toUpperCase(), PAYU_KEY, "508029", "R1", "150.0", "COP", "4"));
        assertTrue(Signatures.payuMatches(Signatures.hmacSha256(PAYU_KEY, base), PAYU_KEY, "508029", "R1", "150.0", "COP", "4"));
        assertFalse(Signatures.payuMatches(Signatures.hash("MD5", base), PAYU_KEY, "508029", "R1", "150.0", "COP", "6"), "another state");
        assertFalse(Signatures.payuMatches(Signatures.hash("MD5", base), "otra-llave", "508029", "R1", "150.0", "COP", "4"));
        assertFalse(Signatures.payuMatches("", PAYU_KEY, "508029", "R1", "150.0", "COP", "4"));
        assertFalse(Signatures.payuMatches(null, PAYU_KEY, "508029", "R1", "150.0", "COP", "4"));
    }
}

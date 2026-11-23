package co.com.arisma.shared.domain;
import static org.junit.jupiter.api.Assertions.*;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import org.junit.jupiter.api.Test;
class PricingTest {
    private static final BigDecimal IVA = BigDecimal.valueOf(19);
    @Test void addsTaxRoundedToPesos() { assertEquals(new BigDecimal("118643"), Pricing.withTax(new BigDecimal("99700"), IVA)); }
    @Test void exemptKeepsPrice() { assertEquals(new BigDecimal("52000"), Pricing.withTax(new BigDecimal("52000"), BigDecimal.ZERO)); }
    @Test void removesTaxAtCentPrecision() { assertEquals(new BigDecimal("99700.00"), Pricing.withoutTax(new BigDecimal("118643"), IVA)); }
    @Test void roundTripKeepsWhatTheAdminTyped() {
        for (int gross = 1; gross < 300_000; gross += 997) {
            var g = BigDecimal.valueOf(gross);
            assertEquals(0, g.compareTo(Pricing.withTax(Pricing.withoutTax(g, IVA), IVA)), "gross " + gross);
            assertEquals(0, g.compareTo(Pricing.withTax(Pricing.withoutTax(g, BigDecimal.valueOf(5)), BigDecimal.valueOf(5))), "gross 5% " + gross);
        }
    }
    @Test void rejectsInvalidRates() { assertThrows(IllegalArgumentException.class, () -> Pricing.withTax(BigDecimal.TEN, BigDecimal.valueOf(100))); }
    @Test void saleWindow() {
        var now = Instant.now();
        assertTrue(Pricing.saleActive(BigDecimal.ONE, null, null, now));
        assertFalse(Pricing.saleActive(BigDecimal.ONE, now.plus(Duration.ofDays(1)), null, now));
        assertFalse(Pricing.saleActive(BigDecimal.ONE, null, now, now));
        assertFalse(Pricing.saleActive(null, null, null, now));
    }
}

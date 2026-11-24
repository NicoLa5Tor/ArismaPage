package dev.nortech.norpress.catalog.domain;
import static org.junit.jupiter.api.Assertions.*;
import java.math.BigDecimal;
import java.util.UUID;
import org.junit.jupiter.api.Test;
class TaxRateTest {
    private static TaxRate rate(String code, String percent) { return new TaxRate(UUID.randomUUID(), code, "IVA", new BigDecimal(percent), true); }
    @Test void validates() {
        assertThrows(IllegalArgumentException.class, () -> rate("IVA 19", "19"));
        assertThrows(IllegalArgumentException.class, () -> rate("iva-19", "100"));
        assertThrows(IllegalArgumentException.class, () -> rate("iva-19", "19.125"));
        assertEquals("iva-5", rate(" iva-5 ", "5.00").code());
    }
    @Test void rateInUseKeepsItsPercent() {
        assertThrows(IllegalArgumentException.class, () -> rate("iva-19", "16").requireCompatibleWith(BigDecimal.valueOf(19), 3));
        assertDoesNotThrow(() -> rate("iva-19", "19.00").requireCompatibleWith(BigDecimal.valueOf(19), 3));
        assertDoesNotThrow(() -> rate("iva-19", "16").requireCompatibleWith(BigDecimal.valueOf(19), 0));
    }
}

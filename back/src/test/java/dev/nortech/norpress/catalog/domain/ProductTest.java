package dev.nortech.norpress.catalog.domain;
import static org.junit.jupiter.api.Assertions.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
class ProductTest {
    private static Product product(Product.Status status, BigDecimal regular, BigDecimal sale, Integer stock, boolean manage, boolean quote) {
        return new Product(UUID.randomUUID(), "Juego", "juego", status, null, regular, sale, null, null, null, manage, stock, null, null, quote, false, false);
    }
    @Test void rejectsNegativeValues() {
        assertThrows(IllegalArgumentException.class, () -> product(Product.Status.DRAFT, BigDecimal.valueOf(-1), null, 0, true, false));
        assertThrows(IllegalArgumentException.class, () -> product(Product.Status.DRAFT, BigDecimal.TEN, null, -1, true, false));
    }
    @Test void supportsQuoteOnlyWithoutPrice() { assertTrue(product(Product.Status.PUBLISHED, null, null, null, false, true).quoteOnly()); }
    @Test void publishedNeedsPriceUnlessQuoteOnly() { assertThrows(IllegalArgumentException.class, () -> product(Product.Status.PUBLISHED, null, null, null, false, false)); }
    @Test void saleMustNotExceedRegular() {
        assertThrows(IllegalArgumentException.class, () -> product(Product.Status.DRAFT, BigDecimal.TEN, BigDecimal.valueOf(11), null, false, false));
        assertThrows(IllegalArgumentException.class, () -> product(Product.Status.DRAFT, null, BigDecimal.ONE, null, false, false));
    }
    @Test void untrackedStockClearsQuantity() { assertNull(product(Product.Status.DRAFT, BigDecimal.TEN, null, 7, false, false).stockQuantity()); }
    @Test void defaultsStockStatus() { assertEquals(Product.StockStatus.INSTOCK, product(Product.Status.DRAFT, BigDecimal.TEN, null, 7, true, false).stockStatus()); }
    @Test void saleWindowOrder() {
        var now = Instant.now();
        assertThrows(IllegalArgumentException.class, () -> new Product(UUID.randomUUID(), "J", "j", Product.Status.DRAFT, null, BigDecimal.TEN, BigDecimal.ONE, now, now, null, false, null, null, null, false, false, false));
    }
}

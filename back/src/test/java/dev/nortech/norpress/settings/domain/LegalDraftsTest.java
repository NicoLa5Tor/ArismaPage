package dev.nortech.norpress.settings.domain;
import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;

class LegalDraftsTest {
    static final StoreProfile STORE = StoreProfileTest.shop("Medellín", "CO-ANT");
    static final Shipping SHIPPING = new Shipping(new BigDecimal("9000"), new BigDecimal("15000"), new BigDecimal("150000"), true, new BigDecimal("50000"));

    static String text(LegalPages.LegalPage page) {
        var out = new StringBuilder(page.title());
        for (var b : page.blocks()) out.append('\n').append(b.text()).append(String.join("\n", b.items()));
        return out.toString();
    }

    @Test void returnsPolicySaysWhatTheStoreReallyDoes() {
        String on = text(LegalDrafts.draft("returns", new LegalDrafts.Facts(STORE, SHIPPING, new CheckoutRules(48, true), "Wompi")));
        assertTrue(on.contains("puedes cancelarlo tú mismo desde tu cuenta"), "the shopper cancels on their own");
        assertTrue(on.contains("2 días"), "unpaid orders wait 48 hours");
        assertTrue(on.contains("artículo 47") && on.contains("artículo 51") && on.contains("www.sic.gov.co"), "retracto, reversión and the SIC");
        assertTrue(on.contains("ventas@norte.co") && on.contains("300 123 4567"), "how to reach the store");
        assertTrue(on.contains("ya no se puede cancelar desde la tienda"), "after it left there is no automatic refund");

        String off = text(LegalDrafts.draft("returns", new LegalDrafts.Facts(STORE, SHIPPING, new CheckoutRules(6, false), "")));
        assertFalse(off.contains("puedes cancelarlo tú mismo"));
        assertTrue(off.contains("escríbenos") && off.contains("6 horas"));
    }
    @Test void shippingPolicyUsesTheStoreRates() {
        String t = text(LegalDrafts.draft("shipping", new LegalDrafts.Facts(STORE, SHIPPING, CheckoutRules.DEFAULT, "")));
        assertTrue(t.contains("Envío en Medellín: $ 9.000. Gratis en compras desde $ 150.000."));
        assertTrue(t.contains("$ 15.000") && t.contains("$ 50.000") && t.contains("Recoger en la tienda"));
        String never = text(LegalDrafts.draft("shipping", new LegalDrafts.Facts(STORE, new Shipping(new BigDecimal("9000"), new BigDecimal("15000"), null, false, BigDecimal.ZERO), CheckoutRules.DEFAULT, "")));
        assertFalse(never.contains("Gratis") || never.contains("Recoger") || never.contains("compra mínima"));
    }
    @Test void everyKindHasADraftThatIsAValidPage() {
        for (String kind : LegalPages.KINDS) {
            var page = LegalDrafts.draft(kind, new LegalDrafts.Facts(STORE, SHIPPING, CheckoutRules.DEFAULT, "PayU"));
            assertTrue(page.published() && !page.title().isBlank(), kind);
            assertEquals(page, LegalPages.LegalPage.fromMap(page.toMap()), kind + " survives being stored");
        }
        assertThrows(IllegalArgumentException.class, () -> LegalDrafts.draft("cookies", new LegalDrafts.Facts(STORE, SHIPPING, CheckoutRules.DEFAULT, "")));
    }
    @Test void pagesStoredBeforeTheNewKindsStillRead() {
        var old = Map.<String, Object>of("terms", Map.of("title", "Términos", "blocks", List.of(Map.of("kind", "paragraph", "text", "Hola")), "documents", List.of()));
        var pages = LegalPages.fromMap(old);
        assertEquals("Términos", pages.terms().title());
        assertFalse(pages.privacy().published());
        assertFalse(pages.page("returns").orElseThrow().published());
        assertTrue(pages.page("cookies").isEmpty());
        assertEquals(List.of("terms", "privacy", "returns", "shipping"), List.copyOf(pages.toMap().keySet()));
    }
    @Test void errorPagesNeedHtmlToBeOn() {
        assertThrows(IllegalArgumentException.class, () -> new ErrorPages.Page(true, " ", "", ""));
        var page = new ErrorPages.Page(true, "<h1>Uy</h1>", "h1{color:red}", "console.log(1)");
        assertTrue(page.live());
        assertFalse(new ErrorPages.Page(false, "<h1>Uy</h1>", "", "").live());
        var pages = ErrorPages.EMPTY.with("not_found", page);
        assertEquals(page, ErrorPages.fromMap(pages.toMap()).page("not_found"));
        assertFalse(pages.page("error").live());
        assertThrows(IllegalArgumentException.class, () -> pages.with("teapot", page));
        assertThrows(IllegalArgumentException.class, () -> new ErrorPages.Page(false, "x".repeat(200_001), "", ""));
    }
}

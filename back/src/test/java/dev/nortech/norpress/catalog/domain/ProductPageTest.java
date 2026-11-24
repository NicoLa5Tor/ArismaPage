package dev.nortech.norpress.catalog.domain;
import static org.junit.jupiter.api.Assertions.*;
import dev.nortech.norpress.catalog.domain.PageSections.Section;
import dev.nortech.norpress.catalog.domain.PageSections.Visibility;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;

class ProductPageTest {
    @Test void sectionsKeepOnlyStatedChoices() {
        var sections = PageSections.parse(Map.of("reviews", "hide", "sku", "SHOW", "related", "inherit", "age", ""));
        assertEquals(Map.of("sku", "show", "reviews", "hide"), sections.toKeys());
        assertEquals(Visibility.INHERIT, sections.of(Section.RELATED));
        assertEquals(Map.of(), PageSections.parse(null).toKeys());
    }
    @Test void unknownSectionsAndValuesAreRefused() {
        assertThrows(IllegalArgumentException.class, () -> PageSections.parse(Map.of("precio", "hide")));
        assertThrows(IllegalArgumentException.class, () -> PageSections.parse(Map.of("reviews", "maybe")));
    }
    @Test void productChoiceWinsOverTheStoreAndTheStoreOverShown() {
        var store = PageSections.parse(Map.of("sku", "hide", "questions", "hide"));
        var shown = PageSections.parse(Map.of("questions", "show", "related", "hide")).resolve(store);
        assertFalse(shown.get("sku"), "the store hides it and the product did not decide");
        assertTrue(shown.get("questions"), "the product shows it although the store hides it");
        assertFalse(shown.get("related"), "the product hides it");
        assertTrue(shown.get("description"), "nobody decided: shown");
        assertEquals(Section.values().length, shown.size());
        assertTrue(PageSections.INHERIT_ALL.resolve(null).values().stream().allMatch(Boolean::booleanValue));
    }
    @Test void textFieldsAreTrimmedAndRefuseMarkup() {
        var page = new ProductPage("  Juego  de mesa ", null, Arrays.asList(" Madera ", "Madera", "", null, "Para 2 a 4 jugadores"), List.of(new ProductPage.Spec(" Peso ", " < 3 kg ")), null);
        assertEquals("Juego de mesa", page.shortDescription());
        assertEquals("", page.descriptionHtml());
        assertEquals(List.of("Madera", "Para 2 a 4 jugadores"), page.highlights());
        assertEquals(new ProductPage.Spec("Peso", "< 3 kg"), page.specs().get(0));
        assertEquals(PageSections.INHERIT_ALL, page.sections());
        assertThrows(IllegalArgumentException.class, () -> new ProductPage("<b>hola</b>", "", null, null, null));
        assertThrows(IllegalArgumentException.class, () -> new ProductPage("", "", List.of("<script>x</script>"), null, null));
        assertThrows(IllegalArgumentException.class, () -> new ProductPage.Spec("Material", ""));
    }
    @Test void limitsAreEnforced() {
        assertThrows(IllegalArgumentException.class, () -> new ProductPage("x".repeat(301), "", null, null, null));
        assertThrows(IllegalArgumentException.class, () -> new ProductPage("", "x".repeat(20_001), null, null, null));
        assertThrows(IllegalArgumentException.class, () -> new ProductPage("", "", IntStream.range(0, 7).mapToObj(i -> "Destacado " + i).toList(), null, null));
        assertThrows(IllegalArgumentException.class, () -> new ProductPage("", "", null, IntStream.range(0, 21).mapToObj(i -> new ProductPage.Spec("Dato " + i, "x")).toList(), null));
        assertThrows(IllegalArgumentException.class, () -> new ProductPage("", "", null, List.of(new ProductPage.Spec("Peso", "1 kg"), new ProductPage.Spec("peso", "2 kg")), null));
    }
}

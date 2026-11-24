package dev.nortech.norpress.catalog.domain;
import static org.junit.jupiter.api.Assertions.*;
import java.util.Arrays;
import java.util.List;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
class SearchProfileTest {
    @Test void keywordsAreTrimmedLoweredAndUnique() {
        var profile = new SearchProfile(Arrays.asList("  Puzzle ", "puzzle", "Armar   Piezas", "", null, "Niños 3D"), null, null);
        assertEquals(List.of("puzzle", "armar piezas", "niños 3d"), profile.keywords());
        assertEquals(List.of(), new SearchProfile(null, null, null).keywords());
    }
    @Test void keywordsAreWordsNotMarkup() {
        assertThrows(IllegalArgumentException.class, () -> new SearchProfile(List.of("<b>puzzle</b>"), null, null));
        assertThrows(IllegalArgumentException.class, () -> new SearchProfile(List.of("a"), null, null));
        assertThrows(IllegalArgumentException.class, () -> new SearchProfile(List.of("x".repeat(41)), null, null));
        assertThrows(IllegalArgumentException.class, () -> new SearchProfile(IntStream.range(0, 41).mapToObj(i -> "palabra " + i).toList(), null, null));
        assertDoesNotThrow(() -> new SearchProfile(IntStream.range(0, 40).mapToObj(i -> "palabra " + i).toList(), null, null));
    }
    @Test void ageRangeIsWholeAndCoherent() {
        assertDoesNotThrow(() -> new SearchProfile(List.of(), 0, 2));
        assertDoesNotThrow(() -> new SearchProfile(List.of(), 8, 8));
        assertThrows(IllegalArgumentException.class, () -> new SearchProfile(List.of(), 4, null));
        assertThrows(IllegalArgumentException.class, () -> new SearchProfile(List.of(), null, 7));
        assertThrows(IllegalArgumentException.class, () -> new SearchProfile(List.of(), 7, 4));
        assertThrows(IllegalArgumentException.class, () -> new SearchProfile(List.of(), -1, 4));
        assertThrows(IllegalArgumentException.class, () -> new SearchProfile(List.of(), 4, 100));
    }
}

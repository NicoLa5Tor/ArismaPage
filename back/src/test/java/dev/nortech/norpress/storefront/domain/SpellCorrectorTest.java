package dev.nortech.norpress.storefront.domain;

import org.junit.jupiter.api.Test;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;

class SpellCorrectorTest {
    // words and counts from a real toy store's published titles
    private final SpellCorrector corrector = new SpellCorrector(Map.ofEntries(
        Map.entry("madera", 523), Map.entry("rompecabezas", 489), Map.entry("Muñeca", 66), Map.entry("títere", 56), Map.entry("lotería", 46),
        Map.entry("cubos", 37), Map.entry("jirafa", 22), Map.entry("caballo", 24), Map.entry("bloques", 9), Map.entry("vaca", 19),
        Map.entry("geométricas", 17), Map.entry("llaves", 16), Map.entry("balón", 11), Map.entry("sonajero", 11), Map.entry("casa", 24), Map.entry("pelota", 30), Map.entry("paleta", 5)));

    private String fix(String text) { return corrector.correct(text).text(); }

    @Test void correctsWordsThatSoundTheSame() {
        assertEquals("rompecabezas de madera", fix("ronpecabesas de madera"));
        assertEquals("jirafa", fix("girafa"));
        assertEquals("caballo", fix("cavallo"));
        assertEquals("bloques", fix("vloques"));
        assertEquals("vaca", fix("baca"));
        assertEquals("llaves", fix("yaves"));
        assertEquals("geometricas", fix("jeometricas"));
    }

    @Test void correctsTyposOnLongerWords() {
        assertEquals("rompecabezas", fix("rompecabeas"));
        assertEquals("sonajero", fix("sonajeor"));
        assertEquals("loteria", fix("lotreia"));
    }

    @Test void leavesKnownShortAndConnectingWordsAlone() {
        var same = corrector.correct("Muñeca de trapo en balón 3");
        // "trapo" is no catalog word and nothing is close: kept as written
        assertEquals("muneca de trapo en balon 3", same.text());
        assertFalse(same.changed());
        // "cabezas" is inside "rompecabezas": the search finds it as written
        assertFalse(corrector.correct("cabezas").changed());
    }

    @Test void aTieGoesToTheMoreUsedWord() {
        // "pelata" is one letter from "pelota" (30) and from "paleta" (5)
        assertEquals("pelota", fix("pelata"));
        assertEquals("casa", fix("caza"));
        var change = corrector.correct("girafa").changes().get(0);
        assertEquals(new SpellCorrector.Change("girafa", "jirafa"), change);
    }

    @Test void anEmptyCatalogCorrectsNothing() {
        assertFalse(SpellCorrector.EMPTY.correct("ronpecabesas").changed());
        assertEquals(java.util.List.of("rompecabezas", "madera"), SpellCorrector.searchWords("Rompecabezas en madera"));
    }
}

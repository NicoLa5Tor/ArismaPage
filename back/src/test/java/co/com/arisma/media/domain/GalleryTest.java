package co.com.arisma.media.domain;
import static org.junit.jupiter.api.Assertions.*;
import java.util.*;
import org.junit.jupiter.api.Test;
class GalleryTest {
    final UUID a = UUID.randomUUID(), b = UUID.randomUUID(), c = UUID.randomUUID();
    final Gallery g = new Gallery(List.of(a, b, c));
    @Test void firstIsPrimary() { assertEquals(a, g.primary()); assertNull(new Gallery(List.of()).primary()); }
    @Test void makePrimaryKeepsTheRestInOrder() { assertEquals(List.of(c, a, b), g.makePrimary(c).order()); }
    @Test void removingPrimaryPromotesNext() { assertEquals(b, g.remove(a).primary()); }
    @Test void reorderMustBeAPermutation() {
        assertEquals(List.of(b, c, a), g.reorder(List.of(b, c, a)).order());
        assertThrows(IllegalArgumentException.class, () -> g.reorder(List.of(a, b)));
        assertThrows(IllegalArgumentException.class, () -> g.reorder(List.of(a, a, b)));
        assertThrows(IllegalArgumentException.class, () -> g.reorder(List.of(a, b, UUID.randomUUID())));
    }
    @Test void foreignImagesAreRejected() { assertThrows(IllegalArgumentException.class, () -> g.makePrimary(UUID.randomUUID())); }
    @Test void limit() { assertThrows(IllegalArgumentException.class, () -> new Gallery(Collections.nCopies(Gallery.MAX_IMAGES, a)).append(b)); }
}

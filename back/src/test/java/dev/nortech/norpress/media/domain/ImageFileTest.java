package dev.nortech.norpress.media.domain;
import static org.junit.jupiter.api.Assertions.*;
import org.junit.jupiter.api.Test;
class ImageFileTest {
    static final byte[] PNG = {(byte)137, 80, 78, 71, 13, 10, 26, 10, 0, 0};
    static final byte[] JPEG = {(byte)255, (byte)216, (byte)255, 0};
    @Test void detectsBySignature() { assertEquals("image/png", ImageFile.of(PNG).contentType()); assertEquals("image/jpeg", ImageFile.of(JPEG).contentType()); }
    @Test void rejectsOtherFiles() { assertThrows(IllegalArgumentException.class, () -> ImageFile.of("<svg/>".getBytes())); }
    @Test void rejectsEmptyAndHuge() {
        assertThrows(IllegalArgumentException.class, () -> ImageFile.of(new byte[0]));
        var big = new byte[ImageFile.MAX_BYTES + 1]; System.arraycopy(PNG, 0, big, 0, PNG.length);
        assertThrows(IllegalArgumentException.class, () -> ImageFile.of(big));
    }
}

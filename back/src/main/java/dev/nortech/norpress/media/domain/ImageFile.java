package dev.nortech.norpress.media.domain;

/** An uploaded image, accepted only when its bytes really are JPEG, PNG or WebP and it weighs at most 5 MB. */
public record ImageFile(byte[] bytes, String contentType) {
    public static final int MAX_BYTES = 5 * 1024 * 1024;
    public static ImageFile of(byte[] bytes) {
        if (bytes == null || bytes.length == 0) throw new IllegalArgumentException("El archivo está vacío");
        if (bytes.length > MAX_BYTES) throw new IllegalArgumentException("La imagen debe pesar máximo 5 MB");
        String type = detect(bytes);
        if (type == null) throw new IllegalArgumentException("Solo se aceptan imágenes JPEG, PNG o WebP");
        return new ImageFile(bytes, type);
    }
    /** Sniffs the file signature instead of trusting the name or the declared type. */
    static String detect(byte[] b) {
        if (b.length >= 3 && (b[0] & 255) == 255 && (b[1] & 255) == 216 && (b[2] & 255) == 255) return "image/jpeg";
        if (b.length >= 8 && (b[0] & 255) == 137 && b[1] == 80 && b[2] == 78 && b[3] == 71 && b[4] == 13 && b[5] == 10 && b[6] == 26 && b[7] == 10) return "image/png";
        if (b.length >= 12 && b[0] == 82 && b[1] == 73 && b[2] == 70 && b[3] == 70 && b[8] == 87 && b[9] == 69 && b[10] == 66 && b[11] == 80) return "image/webp";
        return null;
    }
    public int size() { return bytes.length; }
}

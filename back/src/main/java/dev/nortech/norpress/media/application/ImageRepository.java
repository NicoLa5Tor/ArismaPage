package dev.nortech.norpress.media.application;
import dev.nortech.norpress.media.domain.Gallery;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/** Gallery persistence. Callers that write run inside a transaction; lockGallery holds the product row lock. */
public interface ImageRepository {
    record StoredImage(UUID id, UUID productId, String objectKey, String originalUrl, String contentType) {}
    List<Map<String, Object>> list(UUID productId);
    /** Empty when the product does not exist; otherwise its images in order. */
    Optional<Gallery> lockGallery(UUID productId);
    Optional<StoredImage> find(UUID productId, UUID imageId);
    void insert(UUID productId, UUID imageId, String objectKey, String contentType, int byteSize, String alt);
    void saveOrder(UUID productId, Gallery gallery);
    void updateAlt(UUID imageId, String alt);
    void delete(UUID imageId);
}

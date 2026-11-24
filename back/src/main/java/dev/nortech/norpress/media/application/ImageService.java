package dev.nortech.norpress.media.application;
import dev.nortech.norpress.media.domain.Gallery;
import dev.nortech.norpress.media.domain.ImageFile;
import dev.nortech.norpress.shared.domain.NotFound;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import java.util.*;

/** Product gallery use cases: upload, choose the primary image, reorder, describe and delete. */
@ApplicationScoped
public class ImageService {
    static final int MAX_ALT = 200;
    @Inject ImageRepository images;
    @Inject ObjectStore storage;

    /** Stores the file first; if the database write fails the stored object is removed again. */
    @Transactional
    public List<Map<String, Object>> upload(UUID productId, byte[] bytes, String alt) {
        var file = ImageFile.of(bytes);
        var gallery = gallery(productId);
        gallery.requireRoom();
        UUID id = UUID.randomUUID(); String key = "products/" + productId + "/" + id;
        storage.put(key, file.bytes(), file.contentType());
        try {
            images.insert(productId, id, key, file.contentType(), file.size(), cleanAlt(alt));
            images.saveOrder(productId, gallery.append(id));
        } catch (RuntimeException e) {
            try { storage.delete(key); } catch (RuntimeException ignored) { /* the database error is the one to report */ }
            throw e;
        }
        return images.list(productId);
    }
    @Transactional
    public List<Map<String, Object>> makePrimary(UUID productId, UUID imageId) {
        images.saveOrder(productId, gallery(productId).makePrimary(imageId));
        return images.list(productId);
    }
    @Transactional
    public List<Map<String, Object>> reorder(UUID productId, List<UUID> order) {
        images.saveOrder(productId, gallery(productId).reorder(order));
        return images.list(productId);
    }
    @Transactional
    public List<Map<String, Object>> describe(UUID productId, UUID imageId, String alt) {
        gallery(productId);
        images.find(productId, imageId).orElseThrow(() -> new NotFound("Imagen no encontrada"));
        images.updateAlt(imageId, cleanAlt(alt));
        return images.list(productId);
    }
    /** Historical images (still on the old site) are only unlinked; uploaded files are also removed from storage. */
    @Transactional
    public List<Map<String, Object>> delete(UUID productId, UUID imageId) {
        var next = gallery(productId).remove(imageId);
        var image = images.find(productId, imageId).orElseThrow(() -> new NotFound("Imagen no encontrada"));
        images.delete(imageId);
        images.saveOrder(productId, next);
        if (image.objectKey() != null) storage.delete(image.objectKey());
        return images.list(productId);
    }
    public ObjectStore.StoredObject content(UUID productId, UUID imageId) {
        var image = images.find(productId, imageId).orElseThrow(() -> new NotFound("Imagen no encontrada"));
        if (image.objectKey() == null) throw new NotFound("Esta imagen está en el sitio anterior; usa su dirección original");
        return storage.get(image.objectKey());
    }
    private Gallery gallery(UUID productId) { return images.lockGallery(productId).orElseThrow(() -> new NotFound("Producto no encontrado")); }
    static String cleanAlt(String alt) {
        String value = alt == null ? "" : alt.trim();
        if (value.length() > MAX_ALT) throw new IllegalArgumentException("El texto alternativo admite máximo " + MAX_ALT + " caracteres");
        return value;
    }
}

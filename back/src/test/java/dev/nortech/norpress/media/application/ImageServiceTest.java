package dev.nortech.norpress.media.application;
import static org.junit.jupiter.api.Assertions.*;
import dev.nortech.norpress.media.domain.Gallery;
import dev.nortech.norpress.shared.domain.NotFound;
import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** Gallery use cases against in-memory adapters. */
class ImageServiceTest {
    static final byte[] PNG = {(byte)137, 80, 78, 71, 13, 10, 26, 10, 0, 0};
    static class Store implements ObjectStore {
        final Map<String, byte[]> files = new HashMap<>();
        public void put(String key, byte[] bytes, String type) { files.put(key, bytes); }
        public StoredObject get(String key) { return new StoredObject(files.get(key), "image/png"); }
        public void delete(String key) { files.remove(key); }
    }
    static class Repo implements ImageRepository {
        final UUID product; List<UUID> order = new ArrayList<>(); final Map<UUID, StoredImage> rows = new HashMap<>(); boolean failInsert;
        Repo(UUID product) { this.product = product; }
        public List<Map<String, Object>> list(UUID p) { return order.stream().map(id -> Map.<String, Object>of("id", id)).toList(); }
        public Optional<Gallery> lockGallery(UUID p) { return p.equals(product) ? Optional.of(new Gallery(order)) : Optional.empty(); }
        public Optional<StoredImage> find(UUID p, UUID id) { return Optional.ofNullable(rows.get(id)); }
        public void insert(UUID p, UUID id, String key, String type, int size, String alt) { if (failInsert) throw new IllegalStateException("db down"); rows.put(id, new StoredImage(id, p, key, null, type)); }
        public void saveOrder(UUID p, Gallery g) { order = new ArrayList<>(g.order()); }
        public void updateAlt(UUID id, String alt) {}
        public void delete(UUID id) { rows.remove(id); }
    }
    final UUID product = UUID.randomUUID();
    Repo repo; Store store; ImageService service;
    @BeforeEach void setUp() { repo = new Repo(product); store = new Store(); service = new ImageService(); service.images = repo; service.storage = store; }

    @Test void uploadAppendsAndFirstBecomesPrimary() {
        service.upload(product, PNG, "Frente"); service.upload(product, PNG, null);
        assertEquals(2, repo.order.size()); assertEquals(2, store.files.size());
        var second = repo.order.get(1);
        service.makePrimary(product, second);
        assertEquals(second, repo.order.get(0));
    }
    @Test void failedDatabaseWriteRemovesStoredFile() {
        repo.failInsert = true;
        assertThrows(IllegalStateException.class, () -> service.upload(product, PNG, ""));
        assertTrue(store.files.isEmpty());
    }
    @Test void deleteRemovesFileAndPromotesNext() {
        service.upload(product, PNG, ""); service.upload(product, PNG, "");
        var first = repo.order.get(0);
        service.delete(product, first);
        assertEquals(1, repo.order.size()); assertEquals(1, store.files.size());
    }
    @Test void historicalImagesHaveNoStoredContent() {
        var id = UUID.randomUUID(); repo.rows.put(id, new ImageRepository.StoredImage(id, product, null, "https://tienda.test/x.jpg", null));
        assertThrows(NotFound.class, () -> service.content(product, id));
    }
    @Test void unknownProduct() { assertThrows(NotFound.class, () -> service.upload(UUID.randomUUID(), PNG, "")); }
    @Test void altIsLimited() { service.upload(product, PNG, ""); assertThrows(IllegalArgumentException.class, () -> service.describe(product, repo.order.get(0), "x".repeat(201))); }
}

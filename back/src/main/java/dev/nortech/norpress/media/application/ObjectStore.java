package dev.nortech.norpress.media.application;

/** Private object storage for uploaded images (S3 compatible). */
public interface ObjectStore {
    record StoredObject(byte[] bytes, String contentType) {}
    void put(String key, byte[] bytes, String contentType);
    StoredObject get(String key);
    void delete(String key);
}

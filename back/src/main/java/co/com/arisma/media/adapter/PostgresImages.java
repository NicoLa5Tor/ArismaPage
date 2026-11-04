package co.com.arisma.media.adapter;
import co.com.arisma.media.application.ImageRepository;
import co.com.arisma.media.domain.Gallery;
import co.com.arisma.shared.adapter.Jdbc;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import javax.sql.DataSource;
import java.util.*;

@ApplicationScoped
public class PostgresImages implements ImageRepository {
    @Inject DataSource db;
    public List<Map<String,Object>> list(UUID productId) {
        return Jdbc.with(db,c -> Jdbc.list(c,"SELECT id,object_key IS NOT NULL AS uploaded,original_url,alt,is_primary,position,content_type,byte_size,created_at FROM product_image WHERE product_id=? ORDER BY position,id",productId));
    }
    public Optional<Gallery> lockGallery(UUID productId) {
        return Jdbc.with(db,c -> {
            if(Jdbc.one(c,"SELECT 1 FROM product WHERE id=? FOR UPDATE",productId).isEmpty()) return Optional.<Gallery>empty();
            return Optional.of(new Gallery(Jdbc.list(c,"SELECT id FROM product_image WHERE product_id=? ORDER BY position,id",productId).stream().map(r -> (UUID)r.get("id")).toList()));
        });
    }
    public Optional<StoredImage> find(UUID productId, UUID imageId) {
        return Jdbc.with(db,c -> Jdbc.one(c,"SELECT object_key,original_url,content_type FROM product_image WHERE id=? AND product_id=?",imageId,productId)
            .map(r -> new StoredImage(imageId,productId,(String)r.get("objectKey"),(String)r.get("originalUrl"),(String)r.get("contentType"))));
    }
    /** New rows go to a temporary negative position; saveOrder places them. */
    public void insert(UUID productId, UUID imageId, String objectKey, String contentType, int byteSize, String alt) {
        Jdbc.with(db,c -> Jdbc.update(c,"INSERT INTO product_image(id,product_id,object_key,content_type,byte_size,alt,position) VALUES(?,?,?,?,?,?,(SELECT COALESCE(MIN(position),0)-1 FROM product_image WHERE product_id=?))",imageId,productId,objectKey,contentType,byteSize,alt,productId));
    }
    /** Two steps so the unique (product, position) and single-primary indexes never see a transient duplicate. */
    public void saveOrder(UUID productId, Gallery gallery) {
        Jdbc.with(db,c -> {
            Jdbc.update(c,"UPDATE product_image SET is_primary=false,position=-1000-position WHERE product_id=?",productId);
            if(gallery.order().isEmpty()) return 0;
            var ids=c.createArrayOf("uuid",gallery.order().toArray());
            return Jdbc.update(c,"UPDATE product_image i SET position=o.n-1,is_primary=(o.n=1) FROM unnest(?::uuid[]) WITH ORDINALITY AS o(id,n) WHERE i.id=o.id AND i.product_id=?",ids,productId);
        });
    }
    public void updateAlt(UUID imageId, String alt) { Jdbc.with(db,c -> Jdbc.update(c,"UPDATE product_image SET alt=? WHERE id=?",alt,imageId)); }
    public void delete(UUID imageId) { Jdbc.with(db,c -> Jdbc.update(c,"DELETE FROM product_image WHERE id=?",imageId)); }
}

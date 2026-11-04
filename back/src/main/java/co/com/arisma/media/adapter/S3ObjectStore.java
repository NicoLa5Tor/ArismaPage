package co.com.arisma.media.adapter;
import co.com.arisma.media.application.ObjectStore;
import jakarta.enterprise.context.ApplicationScoped;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import software.amazon.awssdk.auth.credentials.*;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.*;
import java.net.URI;
import java.util.Optional;

@ApplicationScoped
public class S3ObjectStore implements ObjectStore {
    @ConfigProperty(name="arisma.s3.bucket") Optional<String> bucket;
    @ConfigProperty(name="arisma.s3.endpoint") Optional<String> endpoint;
    @ConfigProperty(name="arisma.s3.region",defaultValue="us-east-1") String region;
    private S3Client client() {
        if(bucket.isEmpty() || bucket.get().isBlank()) throw new IllegalStateException("Almacenamiento de imágenes no configurado");
        var builder=S3Client.builder().region(Region.of(region)).credentialsProvider(DefaultCredentialsProvider.create());
        endpoint.ifPresent(value -> { builder.endpointOverride(URI.create(value)); builder.forcePathStyle(true); });
        return builder.build();
    }
    public void put(String key,byte[] bytes,String contentType) { try(var c=client()) { c.putObject(b->b.bucket(bucket.orElseThrow()).key(key).contentType(contentType),RequestBody.fromBytes(bytes)); } }
    public StoredObject get(String key) {
        try(var c=client()) { var r=c.getObjectAsBytes(b->b.bucket(bucket.orElseThrow()).key(key)); return new StoredObject(r.asByteArray(),r.response().contentType()); }
        catch(software.amazon.awssdk.services.s3.model.NoSuchKeyException e) { throw new co.com.arisma.shared.domain.NotFound("El archivo de la imagen no existe en el almacenamiento"); }
    }
    public void delete(String key) { try(var c=client()) { c.deleteObject(b->b.bucket(bucket.orElseThrow()).key(key)); } }
}

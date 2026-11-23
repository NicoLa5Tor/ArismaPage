package co.com.arisma.catalog.adapter;
import co.com.arisma.catalog.application.SearchProfileRepository;
import co.com.arisma.catalog.application.SearchProfileService;
import co.com.arisma.catalog.domain.SearchProfile;
import co.com.arisma.shared.adapter.Requires;
import co.com.arisma.shared.domain.Permission;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import java.util.List;
import java.util.UUID;

/** A product's own keywords and age range; the answer also carries what it takes from its categories. */
@Path("/api/admin/products/{productId}/search") @Produces(MediaType.APPLICATION_JSON) @Consumes(MediaType.APPLICATION_JSON)
public class AdminProductSearchResource {
    @Inject SearchProfileService profiles;
    /** What the panel sends. The domain record checks it, so a wrong value answers 400 with the reason. */
    public record Input(List<String> keywords, Integer ageMin, Integer ageMax) {
        public SearchProfile toDomain() { return new SearchProfile(keywords, ageMin, ageMax); }
    }
    @GET public SearchProfileRepository.ProductProfile get(@PathParam("productId") UUID id) { return profiles.ofProduct(id); }
    @Requires(Permission.CATALOG_EDIT) @PUT public SearchProfileRepository.ProductProfile put(@PathParam("productId") UUID id, Input in) {
        if (in == null) throw new IllegalArgumentException("Datos de búsqueda requeridos");
        return profiles.saveForProduct(id, in.toDomain());
    }
}

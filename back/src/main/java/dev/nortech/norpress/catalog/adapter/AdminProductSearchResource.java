package dev.nortech.norpress.catalog.adapter;
import dev.nortech.norpress.catalog.application.SearchProfileRepository;
import dev.nortech.norpress.catalog.application.SearchProfileService;
import dev.nortech.norpress.catalog.domain.SearchProfile;
import dev.nortech.norpress.shared.adapter.Requires;
import dev.nortech.norpress.shared.domain.Permission;
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

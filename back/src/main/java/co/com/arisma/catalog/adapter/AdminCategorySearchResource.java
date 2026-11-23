package co.com.arisma.catalog.adapter;
import co.com.arisma.catalog.application.SearchProfileService;
import co.com.arisma.catalog.domain.SearchProfile;
import co.com.arisma.shared.adapter.Requires;
import co.com.arisma.shared.domain.Permission;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import java.util.UUID;

/** A category's keywords and age range, inherited by every product in it and in its subcategories. */
@Path("/api/admin/categories/{categoryId}/search") @Produces(MediaType.APPLICATION_JSON) @Consumes(MediaType.APPLICATION_JSON)
public class AdminCategorySearchResource {
    @Inject SearchProfileService profiles;
    @GET public SearchProfile get(@PathParam("categoryId") UUID id) { return profiles.ofCategory(id); }
    @Requires(Permission.CATALOG_EDIT) @PUT public SearchProfile put(@PathParam("categoryId") UUID id, AdminProductSearchResource.Input in) {
        if (in == null) throw new IllegalArgumentException("Datos de búsqueda requeridos");
        return profiles.saveForCategory(id, in.toDomain());
    }
}

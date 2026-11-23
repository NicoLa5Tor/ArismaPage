package co.com.arisma.catalog.adapter;
import co.com.arisma.catalog.application.ProductPageService;
import co.com.arisma.catalog.domain.PageSections;
import co.com.arisma.catalog.domain.ProductPage;
import co.com.arisma.shared.adapter.Requires;
import co.com.arisma.shared.domain.Permission;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Content of a product's public page and which of its sections are shown. */
@Path("/api/admin/products/{productId}/page") @Produces(MediaType.APPLICATION_JSON) @Consumes(MediaType.APPLICATION_JSON)
public class AdminProductPageResource {
    @Inject ProductPageService pages;
    public record SpecInput(String label, String value) {}
    /** sections: {"reviews":"hide"}; a section left out, or set to "inherit", follows the store. */
    public record Input(String shortDescription, String descriptionHtml, List<String> highlights, List<SpecInput> specs, Map<String, String> sections) {}
    public record View(String shortDescription, String descriptionHtml, List<String> highlights, List<ProductPage.Spec> specs, Map<String, String> sections) {
        static View of(ProductPage page) { return new View(page.shortDescription(), page.descriptionHtml(), page.highlights(), page.specs(), page.sections().toKeys()); }
    }

    @GET public View get(@PathParam("productId") UUID id) { return View.of(pages.of(id)); }

    @Requires(Permission.CATALOG_EDIT) @PUT public View put(@PathParam("productId") UUID id, Input in) {
        if (in == null) throw new IllegalArgumentException("Datos de la página requeridos");
        var specs = in.specs() == null ? List.<ProductPage.Spec>of() : in.specs().stream().filter(java.util.Objects::nonNull).map(spec -> new ProductPage.Spec(spec.label(), spec.value())).toList();
        return View.of(pages.save(id, in.shortDescription(), in.descriptionHtml(), in.highlights(), specs, PageSections.parse(in.sections())));
    }
}

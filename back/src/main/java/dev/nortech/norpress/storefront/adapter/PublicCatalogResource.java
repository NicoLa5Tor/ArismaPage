package dev.nortech.norpress.storefront.adapter;
import dev.nortech.norpress.storefront.application.StorefrontService;
import dev.nortech.norpress.storefront.domain.*;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.*;
import java.util.List;
import java.util.UUID;

/** Unauthenticated, read-only catalog for the public store. Lives outside /api/admin, so AdminFilter does not apply. */
@Path("/api/public/catalog") @Produces(MediaType.APPLICATION_JSON)
public class PublicCatalogResource {
    @Inject StorefrontService store;

    @GET @Path("/categories") public Response categories() { return cached(store.categories(), 300); }

    /** Best sellers and catalog size for the home page. */
    @GET @Path("/highlights") public Response highlights() { return cached(store.highlights(), 300); }

    @GET @Path("/products")
    public Response products(@QueryParam("q") String q, @QueryParam("categoria") String category, @QueryParam("orden") String sort,
                             @QueryParam("ofertas") boolean offers, @QueryParam("conPrecio") boolean priced, @QueryParam("pagina") @DefaultValue("1") int page,
                             @QueryParam("exacto") boolean exact) {
        return cached(store.products(new CatalogQuery(q, category, CatalogQuery.Sort.parse(sort), offers, priced, page, exact)), 60);
    }

    @GET @Path("/products/{slug}") public Response product(@PathParam("slug") String slug) { return cached(store.product(slug), 60); }

    /** Read-only feed for the search service: published products changed after `desde` (ISO-8601), 500 per page. */
    @GET @Path("/feed")
    public Response feed(@QueryParam("desde") String since, @QueryParam("pagina") @DefaultValue("1") int page) {
        java.time.Instant from = null;
        if (since != null && !since.isBlank()) {
            try { from = java.time.Instant.parse(since.trim()); } catch (java.time.format.DateTimeParseException e) { return Response.status(400).entity(java.util.Map.of("error", "Fecha 'desde' inválida")).build(); }
        }
        return Response.ok(store.feed(from, page)).header("Cache-Control", "no-store").build();
    }

    @GET @Path("/products/{productId}/images/{imageId}") @Produces({"image/jpeg", "image/png", "image/webp"})
    public Response image(@PathParam("productId") UUID productId, @PathParam("imageId") UUID imageId) {
        var file = store.image(productId, imageId);
        return Response.ok(file.bytes(), file.contentType()).header("Cache-Control", "public, max-age=86400").build();
    }

    private static Response cached(Object body, int seconds) { return Response.ok(body).header("Cache-Control", "public, max-age=" + seconds).build(); }
}

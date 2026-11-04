package co.com.arisma.media.adapter;
import co.com.arisma.shared.adapter.Requires;
import co.com.arisma.shared.domain.Permission;
import co.com.arisma.media.application.ImageRepository;
import co.com.arisma.media.application.ImageService;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.*;
import java.util.*;

/** Product gallery. Every write answers with the whole gallery in its new order, so the panel never re-fetches. */
@Path("/api/admin/products/{productId}/images") @Produces(MediaType.APPLICATION_JSON)
public class AdminImageResource {
    @Inject ImageRepository images;
    @Inject ImageService service;
    public record Description(String alt) {}

    @GET public List<Map<String,Object>> list(@PathParam("productId") UUID productId) { return images.list(productId); }
    @Requires(Permission.CATALOG_EDIT) @POST @Consumes(MediaType.APPLICATION_OCTET_STREAM)
    public Response upload(@PathParam("productId") UUID productId,@QueryParam("alt") String alt,byte[] bytes) { return Response.status(201).entity(service.upload(productId,bytes,alt)).build(); }
    @Requires(Permission.CATALOG_EDIT) @PUT @Path("/order") @Consumes(MediaType.APPLICATION_JSON)
    public List<Map<String,Object>> reorder(@PathParam("productId") UUID productId,List<UUID> order) { return service.reorder(productId,order); }
    @Requires(Permission.CATALOG_EDIT) @POST @Path("/{imageId}/primary")
    public List<Map<String,Object>> primary(@PathParam("productId") UUID productId,@PathParam("imageId") UUID imageId) { return service.makePrimary(productId,imageId); }
    @Requires(Permission.CATALOG_EDIT) @PUT @Path("/{imageId}") @Consumes(MediaType.APPLICATION_JSON)
    public List<Map<String,Object>> describe(@PathParam("productId") UUID productId,@PathParam("imageId") UUID imageId,Description in) { return service.describe(productId,imageId,in==null?null:in.alt()); }
    @Requires(Permission.CATALOG_EDIT) @DELETE @Path("/{imageId}")
    public List<Map<String,Object>> delete(@PathParam("productId") UUID productId,@PathParam("imageId") UUID imageId) { return service.delete(productId,imageId); }
    /** Uploaded files live in a private bucket; the panel reads them through this authenticated endpoint. */
    @GET @Path("/{imageId}/content") @Produces({"image/jpeg","image/png","image/webp"})
    public Response content(@PathParam("productId") UUID productId,@PathParam("imageId") UUID imageId) {
        var file=service.content(productId,imageId);
        return Response.ok(file.bytes(),file.contentType()).header("Cache-Control","private, max-age=3600").build();
    }
}

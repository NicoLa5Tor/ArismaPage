package dev.nortech.norpress.catalog.adapter;
import dev.nortech.norpress.shared.adapter.Requires;
import dev.nortech.norpress.shared.domain.Permission;
import dev.nortech.norpress.catalog.application.CatalogService;
import dev.nortech.norpress.catalog.application.ProductRepository;
import dev.nortech.norpress.catalog.domain.Product;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;

@Path("/api/admin/products") @Produces(MediaType.APPLICATION_JSON) @Consumes(MediaType.APPLICATION_JSON)
public class AdminCatalogResource {
    @Inject ProductRepository products;
    @Inject CatalogService catalog;
    @Context jakarta.ws.rs.container.ContainerRequestContext context;
    /** Prices arrive tax-exclusive; the panel derives them from the tax-inclusive value the admin types. */
    public record Input(String title,String slug,Product.Status status,String sku,BigDecimal regularPrice,BigDecimal salePrice,Instant saleStartsAt,Instant saleEndsAt,UUID taxRateId,
                        boolean manageStock,Integer stockQuantity,Product.StockStatus stockStatus,Product.Backorders backorders,boolean quoteOnly,boolean hidePrice,boolean featured,String stockReason) {
        Product toDomain(UUID id) { return new Product(id,title,slug,status,sku,regularPrice,salePrice,saleStartsAt,saleEndsAt,taxRateId,manageStock,stockQuantity,stockStatus,backorders,quoteOnly,hidePrice,featured); }
    }
    @GET public List<ProductRepository.ProductView> list(@QueryParam("q") @DefaultValue("") String q,@QueryParam("status") String status,@QueryParam("limit") @DefaultValue("30") int limit,@QueryParam("offset") @DefaultValue("0") int offset) {
        return products.search(q,status==null || status.isBlank()?null:Product.Status.valueOf(status.trim().toUpperCase(Locale.ROOT)),limit,offset);
    }
    @GET @Path("/{id}") public ProductRepository.ProductView get(@PathParam("id") UUID id) { return products.view(id).orElseThrow(() -> new dev.nortech.norpress.shared.domain.NotFound("Producto no encontrado")); }
    @Requires(Permission.CATALOG_EDIT) @POST public Response create(Input in) { return Response.status(201).entity(catalog.save(require(in).toDomain(UUID.randomUUID()),actor(),in.stockReason())).build(); }
    @Requires(Permission.CATALOG_EDIT) @PUT @Path("/{id}") public ProductRepository.ProductView update(@PathParam("id") UUID id,Input in) { return catalog.save(require(in).toDomain(id),actor(),in.stockReason()); }
    private UUID actor() { return (UUID)context.getProperty("adminUser"); }
    private static Input require(Input in) { if(in==null) throw new IllegalArgumentException("Datos del producto requeridos"); return in; }
}

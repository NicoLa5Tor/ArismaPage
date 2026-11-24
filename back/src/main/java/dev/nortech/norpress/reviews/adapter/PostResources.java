package dev.nortech.norpress.reviews.adapter;
import dev.nortech.norpress.customers.application.ShopperPorts.Shopper;
import dev.nortech.norpress.reviews.application.ReviewPorts.PostPage;
import dev.nortech.norpress.reviews.application.ReviewPorts.Summary;
import dev.nortech.norpress.reviews.application.ReviewService;
import dev.nortech.norpress.reviews.domain.Post;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.Map;
import java.util.UUID;

/** Reviews and questions over HTTP: anyone reads the published ones and signed-in shoppers write. The panel side is AdminPostResource. */
public final class PostResources {
    private PostResources() {}
    public record Body(String body) {}
    public record StatusInput(String status) {}

    @Path("/api/public/products/{productId}/posts") @Produces(MediaType.APPLICATION_JSON)
    public static class Public {
        @Inject ReviewService reviews;
        /** `open` tells the page whether to offer the form at all. */
        public record Answer(PostPage posts, Summary summary, boolean open) {}
        @GET public Response list(@PathParam("productId") UUID productId, @QueryParam("tipo") @DefaultValue("review") String kind, @QueryParam("pagina") @DefaultValue("1") int page) {
            var parsed = Post.Kind.parse(kind);
            boolean open = reviews.open(productId, parsed);
            // a closed section answers empty, so hiding it in the panel also takes its posts off the store
            var posts = open ? reviews.published(productId, parsed, page) : new PostPage(java.util.List.of(), 0, 1, ReviewService.PAGE_SIZE);
            return Response.ok(new Answer(posts, open && parsed == Post.Kind.REVIEW ? reviews.summary(productId) : Summary.NONE, open)).header("Cache-Control", "no-store").build();
        }
    }

    @Path("/api/shop") @Produces(MediaType.APPLICATION_JSON) @Consumes(MediaType.APPLICATION_JSON)
    public static class Shop {
        @Inject ReviewService reviews;
        @Context ContainerRequestContext context;
        public record Input(String kind, Integer rating, String body) {}
        @POST @Path("/products/{productId}/posts") public Response submit(@PathParam("productId") UUID productId, Input in) {
            if (in == null) throw new IllegalArgumentException("Escribe tu opinión o tu pregunta");
            var done = reviews.submit(shopper(), productId, new Post(Post.Kind.parse(in.kind() == null ? "" : in.kind()), in.rating(), in.body()));
            return Response.status(201).entity(Map.of("id", done.id(), "status", done.status().db())).build();
        }
        @POST @Path("/posts/{postId}/replies") public Response reply(@PathParam("postId") UUID postId, Body in) {
            var done = reviews.reply(shopper(), postId, in == null ? null : in.body());
            return Response.status(201).entity(Map.of("id", done.id(), "status", done.status().db())).build();
        }
        private Shopper shopper() { return (Shopper) context.getProperty("shopper"); }
    }
}

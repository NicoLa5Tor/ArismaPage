package co.com.arisma.reviews.adapter;
import co.com.arisma.reviews.application.ReviewPorts.PostPage;
import co.com.arisma.reviews.application.ReviewService;
import co.com.arisma.reviews.domain.Post;
import co.com.arisma.shared.adapter.Requires;
import co.com.arisma.shared.domain.Permission;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.Map;
import java.util.UUID;

/** Moderation of reviews and questions: approve, hide and answer in the name of the store. */
@Path("/api/admin/posts") @Produces(MediaType.APPLICATION_JSON) @Consumes(MediaType.APPLICATION_JSON)
public class AdminPostResource {
    @Inject ReviewService reviews;
    @Context ContainerRequestContext context;
    @GET public PostPage list(@QueryParam("estado") String status, @QueryParam("pagina") @DefaultValue("1") int page) {
        return reviews.moderation(status == null || status.isBlank() ? null : Post.Status.parse(status), page);
    }
    @GET @Path("/pending") public Map<String, Long> pending() { return Map.of("pending", reviews.pending()); }
    @Requires(Permission.REVIEWS_MANAGE) @PUT @Path("/{postId}/status") public Map<String, Boolean> moderate(@PathParam("postId") UUID postId, PostResources.StatusInput in) {
        reviews.moderate(postId, Post.Status.parse(in == null || in.status() == null ? "" : in.status())); return Map.of("ok", true);
    }
    @Requires(Permission.REVIEWS_MANAGE) @PUT @Path("/replies/{replyId}/status") public Map<String, Boolean> moderateReply(@PathParam("replyId") UUID replyId, PostResources.StatusInput in) {
        reviews.moderateReply(replyId, Post.Status.parse(in == null || in.status() == null ? "" : in.status())); return Map.of("ok", true);
    }
    @Requires(Permission.REVIEWS_MANAGE) @POST @Path("/{postId}/replies") public Response reply(@PathParam("postId") UUID postId, PostResources.Body in) {
        return Response.status(201).entity(Map.of("id", reviews.staffReply(postId, in == null ? null : in.body(), (UUID) context.getProperty("adminUser")))).build();
    }
}

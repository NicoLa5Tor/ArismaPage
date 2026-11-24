package dev.nortech.norpress.reviews.application;
import dev.nortech.norpress.reviews.domain.Post;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/** Ports of the reviews module. */
public final class ReviewPorts {
    private ReviewPorts() {}

    /** Average and how many published reviews gave each number of stars (index 0 is one star). */
    public record Summary(double average, long count, List<Long> stars) {
        public static final Summary NONE = new Summary(0, 0, List.of(0L, 0L, 0L, 0L, 0L));
    }
    public record PostPage(List<Map<String, Object>> items, long total, int page, int pageSize) {}
    /** Where a post stands, for the checks around replying and moderating. */
    public record PostRef(UUID id, UUID productId, Post.Kind kind, Post.Status status) {}

    public interface PostRepository {
        long postsSince(UUID accountId, Instant since);
        /** Conflict when the account already reviewed the product. */
        UUID insert(UUID productId, UUID accountId, Post post, String authorName, boolean verifiedPurchase, Post.Status status);
        UUID insertReply(UUID postId, UUID accountId, UUID adminId, boolean staff, String authorName, String body, Post.Status status);
        Optional<PostRef> find(UUID postId);
        boolean setStatus(UUID postId, Post.Status status);
        boolean setReplyStatus(UUID replyId, Post.Status status);

        Summary summary(UUID productId);
        /** Published posts of one kind with their published replies, newest first. */
        PostPage published(UUID productId, Post.Kind kind, int page, int pageSize);
        /** Posts for moderation, with every reply and the product they belong to. status null means all. */
        PostPage moderation(Post.Status status, int page, int pageSize);
        /** How many posts and replies wait for approval. */
        long pending();
    }
}

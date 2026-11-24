package dev.nortech.norpress.reviews.application;
import dev.nortech.norpress.catalog.application.ProductPageService;
import dev.nortech.norpress.catalog.domain.PageSections.Section;
import dev.nortech.norpress.customers.application.ShopperPorts.Shopper;
import dev.nortech.norpress.reviews.application.ReviewPorts.*;
import dev.nortech.norpress.reviews.domain.Post;
import dev.nortech.norpress.settings.application.StoreSettingsService;
import dev.nortech.norpress.shared.domain.Forbidden;
import dev.nortech.norpress.shared.domain.NotFound;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import java.time.Clock;
import java.time.Duration;
import java.util.UUID;

/**
 * Reviews and questions on products. What a shopper may do follows the store settings (on or off, moderation, buyers
 * only, replies between shoppers) and the product's own page sections; the panel approves, hides and answers.
 */
@ApplicationScoped
public class ReviewService {
    public static final int PAGE_SIZE = 10, MODERATION_PAGE = 30, MAX_PER_HOUR = 6;
    public record Submitted(UUID id, Post.Status status) {}
    @Inject PostRepository posts;
    @Inject StoreSettingsService settings;
    @Inject ProductPageService pages;
    @Inject dev.nortech.norpress.catalog.application.SellableProducts catalog;
    @Inject dev.nortech.norpress.sales.application.PurchaseHistory purchases;
    Clock clock = Clock.systemUTC();

    /** Whether the product takes this kind of post: the store allows it and the product's page shows that section. */
    public boolean open(UUID productId, Post.Kind kind) {
        var rules = settings.conversations();
        if (kind == Post.Kind.REVIEW ? !rules.reviews() : !rules.questions()) return false;
        var section = kind == Post.Kind.REVIEW ? Section.REVIEWS : Section.QUESTIONS;
        return pages.of(productId).sections().resolve(settings.pageSections()).getOrDefault(section.key(), true);
    }

    @Transactional
    public Submitted submit(Shopper shopper, UUID productId, Post post) {
        if (!catalog.published(productId)) throw new NotFound("Producto no encontrado");
        if (!open(productId, post.kind())) throw new Forbidden(post.kind() == Post.Kind.REVIEW ? "Este producto no recibe opiniones" : "Este producto no recibe preguntas", 0);
        throttle(shopper);
        var rules = settings.conversations();
        // only a verified address proves the purchase history is this person's
        boolean bought = shopper.emailVerified() && purchases.purchased(shopper.customerId(), productId);
        if (post.kind() == Post.Kind.REVIEW && rules.buyersOnly() && !bought) throw new Forbidden("Solo pueden opinar quienes compraron este producto con su cuenta verificada", 0);
        var status = rules.manualModeration() ? Post.Status.PENDING : Post.Status.PUBLISHED;
        return new Submitted(posts.insert(productId, shopper.accountId(), post, Post.publicName(shopper.name()), post.kind() == Post.Kind.REVIEW && bought, status), status);
    }

    @Transactional
    public Submitted reply(Shopper shopper, UUID postId, String body) {
        var rules = settings.conversations();
        if (!rules.customerReplies()) throw new Forbidden("Por ahora solo " + settings.profile().shortName() + " responde", 0);
        var post = posts.find(postId).filter(p -> p.status() == Post.Status.PUBLISHED).orElseThrow(() -> new NotFound("Publicación no encontrada"));
        if (!open(post.productId(), post.kind())) throw new Forbidden("Esta conversación está cerrada", 0);
        throttle(shopper);
        var status = rules.manualModeration() ? Post.Status.PENDING : Post.Status.PUBLISHED;
        return new Submitted(posts.insertReply(postId, shopper.accountId(), null, false, Post.publicName(shopper.name()), Post.reply(body), status), status);
    }

    public Summary summary(UUID productId) { return posts.summary(productId); }
    public PostPage published(UUID productId, Post.Kind kind, int page) { return posts.published(productId, kind, Math.max(1, page), PAGE_SIZE); }

    // Panel
    public PostPage moderation(Post.Status status, int page) { return posts.moderation(status, Math.max(1, page), MODERATION_PAGE); }
    public long pending() { return posts.pending(); }
    @Transactional public void moderate(UUID postId, Post.Status status) { if (!posts.setStatus(postId, status)) throw new NotFound("Publicación no encontrada"); }
    @Transactional public void moderateReply(UUID replyId, Post.Status status) { if (!posts.setReplyStatus(replyId, status)) throw new NotFound("Respuesta no encontrada"); }
    /** The store answers in its own name and the answer is public at once; answering a pending post also approves it. */
    @Transactional
    public UUID staffReply(UUID postId, String body, UUID admin) {
        var post = posts.find(postId).orElseThrow(() -> new NotFound("Publicación no encontrada"));
        UUID id = posts.insertReply(postId, null, admin, true, settings.profile().name(), Post.reply(body), Post.Status.PUBLISHED);
        if (post.status() == Post.Status.PENDING) posts.setStatus(postId, Post.Status.PUBLISHED);
        return id;
    }

    private void throttle(Shopper shopper) {
        if (posts.postsSince(shopper.accountId(), clock.instant().minus(Duration.ofHours(1))) >= MAX_PER_HOUR) throw new Forbidden("Has escrito mucho en poco tiempo. Intenta de nuevo más tarde.", 3600);
    }
}

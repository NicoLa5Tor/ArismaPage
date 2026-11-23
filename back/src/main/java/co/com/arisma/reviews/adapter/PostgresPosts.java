package co.com.arisma.reviews.adapter;
import co.com.arisma.reviews.application.ReviewPorts.*;
import co.com.arisma.reviews.domain.Post;
import co.com.arisma.shared.adapter.Jdbc;
import co.com.arisma.shared.domain.Conflict;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.SQLException;
import java.time.Instant;
import java.util.*;

@ApplicationScoped
public class PostgresPosts implements PostRepository {
    @Inject DataSource db;

    public long postsSince(UUID accountId, Instant since) {
        return Jdbc.with(db, c -> Jdbc.count(c, "SELECT (SELECT count(*) FROM product_post WHERE account_id=? AND created_at>?) + (SELECT count(*) FROM product_post_reply WHERE account_id=? AND created_at>?) AS n", accountId, since, accountId, since));
    }
    public UUID insert(UUID productId, UUID accountId, Post post, String authorName, boolean verifiedPurchase, Post.Status status) {
        UUID id = UUID.randomUUID();
        try {
            Jdbc.with(db, c -> Jdbc.update(c, "INSERT INTO product_post(id,product_id,account_id,kind,rating,body,author_name,verified_purchase,status) VALUES(?,?,?,?,?,?,?,?,?)",
                id, productId, accountId, post.kind().db(), post.rating(), post.body(), authorName, verifiedPurchase, status.db()));
        } catch (IllegalStateException e) {
            if (Jdbc.duplicate(e)) throw new Conflict("Ya opinaste sobre este producto");
            throw e;
        }
        return id;
    }
    public UUID insertReply(UUID postId, UUID accountId, UUID adminId, boolean staff, String authorName, String body, Post.Status status) {
        UUID id = UUID.randomUUID();
        Jdbc.with(db, c -> Jdbc.update(c, "INSERT INTO product_post_reply(id,post_id,account_id,admin_id,staff,author_name,body,status) VALUES(?,?,?,?,?,?,?,?)", id, postId, accountId, adminId, staff, authorName, body, status.db()));
        return id;
    }
    public Optional<PostRef> find(UUID postId) {
        return Jdbc.with(db, c -> Jdbc.one(c, "SELECT product_id, kind, status FROM product_post WHERE id=?", postId)
            .map(r -> new PostRef(postId, (UUID) r.get("productId"), Post.Kind.parse((String) r.get("kind")), Post.Status.parse((String) r.get("status")))));
    }
    public boolean setStatus(UUID postId, Post.Status status) { return Jdbc.with(db, c -> Jdbc.update(c, "UPDATE product_post SET status=?, updated_at=now() WHERE id=?", status.db(), postId) > 0); }
    public boolean setReplyStatus(UUID replyId, Post.Status status) { return Jdbc.with(db, c -> Jdbc.update(c, "UPDATE product_post_reply SET status=? WHERE id=?", status.db(), replyId) > 0); }

    public Summary summary(UUID productId) {
        return Jdbc.with(db, c -> {
            var stars = new ArrayList<>(List.of(0L, 0L, 0L, 0L, 0L));
            long count = 0, sum = 0;
            for (var row : Jdbc.list(c, "SELECT rating, count(*) AS n FROM product_post WHERE product_id=? AND kind='review' AND status='published' GROUP BY rating", productId)) {
                int rating = ((Number) row.get("rating")).intValue(); long n = ((Number) row.get("n")).longValue();
                stars.set(rating - 1, n); count += n; sum += rating * n;
            }
            return count == 0 ? Summary.NONE : new Summary(Math.round(sum * 10.0 / count) / 10.0, count, List.copyOf(stars));
        });
    }

    public PostPage published(UUID productId, Post.Kind kind, int page, int pageSize) {
        return Jdbc.with(db, c -> {
            long total = Jdbc.count(c, "SELECT count(*) AS n FROM product_post WHERE product_id=? AND kind=? AND status='published'", productId, kind.db());
            // verified purchases first for reviews, then the newest
            var items = Jdbc.list(c, "SELECT id, kind, rating, body, author_name, verified_purchase, created_at FROM product_post WHERE product_id=? AND kind=? AND status='published' ORDER BY created_at DESC, id LIMIT ? OFFSET ?",
                productId, kind.db(), pageSize, (page - 1) * pageSize);
            attachReplies(c, items, "AND r.status='published'", "r.id, r.post_id, r.staff, r.author_name, r.body, r.created_at");
            return new PostPage(items, total, page, pageSize);
        });
    }

    public PostPage moderation(Post.Status status, int page, int pageSize) {
        String st = status == null ? "" : status.db();
        return Jdbc.with(db, c -> {
            // a published post with a reply still waiting also belongs to the pending queue
            String where = " WHERE (?='' OR p.status=? OR (?='pending' AND EXISTS (SELECT 1 FROM product_post_reply r WHERE r.post_id=p.id AND r.status='pending')))";
            long total = Jdbc.count(c, "SELECT count(*) AS n FROM product_post p" + where, st, st, st);
            var items = Jdbc.list(c, "SELECT p.id, p.kind, p.rating, p.body, p.author_name, p.verified_purchase, p.status, p.created_at, p.product_id, d.title AS product_title, d.slug AS product_slug, a.email AS account_email"
                + " FROM product_post p JOIN product d ON d.id=p.product_id LEFT JOIN customer_account a ON a.id=p.account_id" + where + " ORDER BY (p.status='pending') DESC, p.created_at DESC, p.id LIMIT ? OFFSET ?",
                st, st, st, pageSize, (page - 1) * pageSize);
            attachReplies(c, items, "", "r.id, r.post_id, r.staff, r.author_name, r.body, r.status, r.created_at");
            return new PostPage(items, total, page, pageSize);
        });
    }
    public long pending() {
        return Jdbc.with(db, c -> Jdbc.count(c, "SELECT (SELECT count(*) FROM product_post WHERE status='pending') + (SELECT count(*) FROM product_post_reply WHERE status='pending') AS n"));
    }

    private static void attachReplies(Connection c, List<Map<String, Object>> posts, String filter, String columns) throws SQLException {
        if (posts.isEmpty()) return;
        var byPost = new HashMap<UUID, List<Map<String, Object>>>();
        try (var s = c.prepareStatement("SELECT " + columns + " FROM product_post_reply r WHERE r.post_id = ANY(?) " + filter + " ORDER BY r.created_at, r.id")) {
            s.setArray(1, c.createArrayOf("uuid", posts.stream().map(p -> p.get("id")).toArray()));
            try (var r = s.executeQuery()) {
                var meta = r.getMetaData();
                while (r.next()) {
                    var row = new LinkedHashMap<String, Object>();
                    for (int i = 1; i <= meta.getColumnCount(); i++) {
                        Object value = r.getObject(i);
                        row.put(camel(meta.getColumnLabel(i)), value instanceof java.sql.Timestamp t ? t.toInstant() : value);
                    }
                    byPost.computeIfAbsent((UUID) row.remove("postId"), k -> new ArrayList<>()).add(row);
                }
            }
        }
        for (var post : posts) post.put("replies", byPost.getOrDefault((UUID) post.get("id"), List.of()));
    }
    private static String camel(String s) {
        var b = new StringBuilder(); boolean up = false;
        for (char ch : s.toCharArray()) { if (ch == '_') up = true; else { b.append(up ? Character.toUpperCase(ch) : ch); up = false; } }
        return b.toString();
    }
}

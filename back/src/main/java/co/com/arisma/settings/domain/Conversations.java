package co.com.arisma.settings.domain;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * How reviews and questions work in the store. With manual moderation a post waits for approval; buyersOnly limits
 * reviews (never questions) to accounts that bought the product; customerReplies lets shoppers answer each other.
 */
public record Conversations(boolean reviews, boolean questions, boolean manualModeration, boolean buyersOnly, boolean customerReplies) {
    public static final String KEY = "conversations";
    public static final Conversations DEFAULT = new Conversations(true, true, true, false, false);
    public static Conversations fromMap(Map<String, Object> m) {
        if (m == null || m.isEmpty()) return DEFAULT;
        return new Conversations(flag(m, "reviews", DEFAULT.reviews), flag(m, "questions", DEFAULT.questions), flag(m, "manualModeration", DEFAULT.manualModeration), flag(m, "buyersOnly", DEFAULT.buyersOnly), flag(m, "customerReplies", DEFAULT.customerReplies));
    }
    public Map<String, Object> toMap() {
        var out = new LinkedHashMap<String, Object>();
        out.put("reviews", reviews); out.put("questions", questions); out.put("manualModeration", manualModeration); out.put("buyersOnly", buyersOnly); out.put("customerReplies", customerReplies);
        return out;
    }
    static boolean flag(Map<String, Object> m, String key, boolean fallback) { return m.get(key) instanceof Boolean b ? b : fallback; }
}

package co.com.arisma.storefront.domain;
import java.util.Map;
import java.util.regex.Pattern;

/** Turns WooCommerce description HTML into searchable plain text: no tags, scripts or styles, common entities decoded, spaces collapsed. */
public final class PlainText {
    public static final int MAX_LENGTH = 2000;
    private static final Pattern BLOCKS = Pattern.compile("(?is)<(script|style)[^>]*>.*?</\\1>");
    private static final Pattern TAGS = Pattern.compile("<[^>]+>");
    private static final Pattern NUMERIC = Pattern.compile("&#(x?)([0-9a-fA-F]+);");
    private static final Pattern SPACES = Pattern.compile("\\s+");
    private static final Map<String, String> ENTITIES = Map.of("&nbsp;", " ", "&amp;", "&", "&lt;", "<", "&gt;", ">", "&quot;", "\"", "&#039;", "'", "&apos;", "'");
    private PlainText() {}

    public static String of(String html) {
        if (html == null || html.isBlank()) return "";
        String text = TAGS.matcher(BLOCKS.matcher(html).replaceAll(" ")).replaceAll(" ");
        for (var e : ENTITIES.entrySet()) text = text.replace(e.getKey(), e.getValue());
        text = NUMERIC.matcher(text).replaceAll(m -> {
            try { return String.valueOf(Character.toChars(Integer.parseInt(m.group(2), m.group(1).isEmpty() ? 10 : 16))).replace("\\", "\\\\").replace("$", "\\$"); }
            catch (IllegalArgumentException e) { return " "; }
        });
        text = SPACES.matcher(text).replaceAll(" ").trim();
        return text.length() > MAX_LENGTH ? text.substring(0, MAX_LENGTH) : text;
    }
}

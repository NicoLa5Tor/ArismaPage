package co.com.arisma.catalog.adapter;
import co.com.arisma.catalog.application.HtmlCleaner;
import jakarta.enterprise.context.ApplicationScoped;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.safety.Safelist;

@ApplicationScoped
public class JsoupHtmlCleaner implements HtmlCleaner {
    /** Text formatting only. Links may go to http(s), mail and phone, and never pass ranking or the opener. */
    private static final Safelist ALLOWED = new Safelist()
        .addTags("p", "br", "ul", "ol", "li", "strong", "b", "em", "i", "u", "h3", "h4", "a")
        .addAttributes("a", "href")
        .addProtocols("a", "href", "http", "https", "mailto", "tel")
        .addEnforcedAttribute("a", "rel", "nofollow noopener noreferrer")
        .addEnforcedAttribute("a", "target", "_blank");
    private static final Document.OutputSettings COMPACT = new Document.OutputSettings().prettyPrint(false);

    public String clean(String html) {
        if (html == null || html.isBlank()) return "";
        // empty paragraphs and non-breaking filler are what old descriptions are padded with
        return Jsoup.clean(html, "", ALLOWED, COMPACT).replace("&nbsp;", " ").replaceAll("<p>\\s*</p>", "").trim();
    }
}

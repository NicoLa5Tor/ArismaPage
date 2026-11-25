package dev.nortech.norpress.settings.domain;
import java.util.*;

/**
 * The store's own error pages: what a shopper sees on an address that does not exist ("not_found") and when something
 * fails ("error"). The store writes HTML, CSS and JavaScript; while a page is off, or empty, the store's built-in page is
 * shown. The code never runs inside the store's own page: fronts show it in a sandboxed frame with no access to the
 * shopper's session, so it can use the store's styles and scripts but never read or change an account or a checkout.
 */
public record ErrorPages(Map<String, Page> pages) {
    public static final String KEY = "error_pages";
    public static final List<String> KINDS = List.of("not_found", "error");
    public static final ErrorPages EMPTY = new ErrorPages(Map.of());
    static final int MAX_HTML = 200_000, MAX_CSS = 100_000, MAX_JS = 100_000;

    public ErrorPages {
        var all = new LinkedHashMap<String, Page>();
        for (String kind : KINDS) all.put(kind, pages == null || pages.get(kind) == null ? Page.EMPTY : pages.get(kind));
        pages = Collections.unmodifiableMap(all);
    }
    public static boolean known(String kind) { return kind != null && KINDS.contains(kind); }
    public Page page(String kind) {
        if (!known(kind)) throw new IllegalArgumentException("Esa página de error no existe");
        return pages.get(kind);
    }
    public ErrorPages with(String kind, Page page) {
        if (!known(kind)) throw new IllegalArgumentException("Esa página de error no existe");
        var next = new LinkedHashMap<>(pages);
        next.put(kind, page);
        return new ErrorPages(next);
    }

    /** enabled: the store shows this page instead of its built-in one (only when it has HTML). */
    public record Page(boolean enabled, String html, String css, String js) {
        public static final Page EMPTY = new Page(false, "", "", "");
        public Page {
            html = limit(html, MAX_HTML, "El HTML");
            css = limit(css, MAX_CSS, "El CSS");
            js = limit(js, MAX_JS, "El JavaScript");
            if (enabled && html.isBlank()) throw new IllegalArgumentException("Escribe el HTML antes de activar la página");
        }
        /** Shown to shoppers: on and with HTML. */
        public boolean live() { return enabled && !html.isBlank(); }
        public Map<String, Object> toMap() {
            var out = new LinkedHashMap<String, Object>();
            out.put("enabled", enabled); out.put("html", html); out.put("css", css); out.put("js", js);
            return out;
        }
        public static Page fromMap(Object o) {
            if (!(o instanceof Map<?, ?> m)) return EMPTY;
            return new Page(Boolean.TRUE.equals(m.get("enabled")), Objects.toString(m.get("html"), ""), Objects.toString(m.get("css"), ""), Objects.toString(m.get("js"), ""));
        }
    }

    public static ErrorPages fromMap(Map<String, Object> m) {
        if (m == null || m.isEmpty()) return EMPTY;
        var pages = new LinkedHashMap<String, Page>();
        for (String kind : KINDS) pages.put(kind, Page.fromMap(m.get(kind)));
        return new ErrorPages(pages);
    }
    public Map<String, Object> toMap() {
        var out = new LinkedHashMap<String, Object>();
        pages.forEach((kind, page) -> out.put(kind, page.toMap()));
        return out;
    }
    private static String limit(String value, int max, String what) {
        String v = value == null ? "" : value.replace("\r\n", "\n");
        if (v.length() > max) throw new IllegalArgumentException(what + " admite " + (max / 1000) + " mil caracteres");
        return v;
    }
}

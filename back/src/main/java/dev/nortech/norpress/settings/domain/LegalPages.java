package dev.nortech.norpress.settings.domain;
import java.util.*;
import java.util.regex.Pattern;

/**
 * The store's legal pages, written by the store itself: terms of use, the personal data policy, the returns and refunds
 * policy and the shipping policy. Each page is plain text in blocks (headings, paragraphs and lists, never HTML) plus the
 * documents it attaches, such as the signed PDF of the data policy. These are the drafts the panel edits; what shoppers
 * read and accept are the published versions (LegalVersion).
 */
public record LegalPages(Map<String, LegalPage> pages) {
    public static final String KEY = "legal";
    /** Every kind, in the order the store lists them. */
    public static final List<String> KINDS = List.of("terms", "privacy", "returns", "shipping");
    public static final LegalPages EMPTY = new LegalPages(Map.of());

    public LegalPages {
        var all = new LinkedHashMap<String, LegalPage>();
        for (String kind : KINDS) all.put(kind, pages == null || pages.get(kind) == null ? LegalPage.EMPTY : pages.get(kind));
        pages = Collections.unmodifiableMap(all);
    }
    public static boolean known(String kind) { return kind != null && KINDS.contains(kind); }
    public LegalPage terms() { return pages.get("terms"); }
    public LegalPage privacy() { return pages.get("privacy"); }

    /** The page by the name fronts use; empty for an unknown name. */
    public Optional<LegalPage> page(String kind) { return known(kind) ? Optional.of(pages.get(kind)) : Optional.empty(); }
    /** The same pages with one of them replaced. */
    public LegalPages with(String kind, LegalPage page) {
        if (!known(kind)) throw new IllegalArgumentException("Esa página legal no existe");
        var next = new LinkedHashMap<>(pages);
        next.put(kind, page);
        return new LegalPages(next);
    }

    /** heading is a section title, subheading a title inside a section; a list carries items instead of text. */
    public record Block(String kind, String text, List<String> items) {
        static final Set<String> KINDS = Set.of("heading", "subheading", "paragraph", "list");
        public Block {
            if (!KINDS.contains(kind)) throw new IllegalArgumentException("Cada bloque es un título, un subtítulo, un párrafo o una lista");
            text = clean(text, 6000, "Un bloque");
            items = items == null ? List.of() : items.stream().map(i -> clean(i, 2000, "Un punto de la lista")).filter(i -> !i.isEmpty()).toList();
            if (kind.equals("list") ? items.isEmpty() : text.isEmpty()) throw new IllegalArgumentException("Hay un bloque vacío en la página legal");
            if (items.size() > 100) throw new IllegalArgumentException("Una lista admite 100 puntos");
        }
        Map<String, Object> toMap() {
            var out = new LinkedHashMap<String, Object>();
            out.put("kind", kind);
            if (kind.equals("list")) out.put("items", items); else out.put("text", text);
            return out;
        }
        static Block fromMap(Object o) {
            if (!(o instanceof Map<?, ?> m)) throw new IllegalArgumentException("Bloque inválido");
            List<String> items = m.get("items") instanceof List<?> l ? l.stream().map(i -> Objects.toString(i, "")).toList() : List.of();
            return new Block(Objects.toString(m.get("kind"), ""), Objects.toString(m.get("text"), ""), items);
        }
    }

    /** A file the page attaches; file is its name in the store's storage, such as politica-de-datos.pdf. */
    public record Document(String title, String file) {
        public static final Pattern FILE = Pattern.compile("[a-z0-9][a-z0-9-]{0,80}\\.pdf");
        public Document {
            title = clean(title, 120, "El nombre del documento");
            file = file == null ? "" : file.trim();
            if (!FILE.matcher(file).matches()) throw new IllegalArgumentException("El documento debe ser un PDF con un nombre en minúsculas, sin espacios");
            if (title.isEmpty()) title = file;
        }
        Map<String, Object> toMap() { return new LinkedHashMap<>(Map.of("title", title, "file", file)); }
        static Document fromMap(Object o) {
            if (!(o instanceof Map<?, ?> m)) throw new IllegalArgumentException("Documento inválido");
            return new Document(Objects.toString(m.get("title"), ""), Objects.toString(m.get("file"), ""));
        }
    }

    public record LegalPage(String title, List<Block> blocks, List<Document> documents) {
        public static final LegalPage EMPTY = new LegalPage("", List.of(), List.of());
        public LegalPage {
            title = clean(title, 120, "El título de la página");
            blocks = blocks == null ? List.of() : List.copyOf(blocks);
            documents = documents == null ? List.of() : List.copyOf(documents);
            if (blocks.size() > 400) throw new IllegalArgumentException("Una página legal admite 400 bloques");
            if (documents.size() > 10) throw new IllegalArgumentException("Una página legal admite 10 documentos");
            if (!blocks.isEmpty() && title.isEmpty()) throw new IllegalArgumentException("Escribe el título de la página legal");
        }
        public boolean published() { return !blocks.isEmpty() || !documents.isEmpty(); }
        public Map<String, Object> toMap() {
            var out = new LinkedHashMap<String, Object>();
            out.put("title", title);
            out.put("blocks", blocks.stream().map(Block::toMap).toList());
            out.put("documents", documents.stream().map(Document::toMap).toList());
            return out;
        }
        public static LegalPage fromMap(Object o) {
            if (!(o instanceof Map<?, ?> m)) return EMPTY;
            List<Block> blocks = m.get("blocks") instanceof List<?> l ? l.stream().map(Block::fromMap).toList() : List.of();
            List<Document> documents = m.get("documents") instanceof List<?> l ? l.stream().map(Document::fromMap).toList() : List.of();
            return new LegalPage(Objects.toString(m.get("title"), ""), blocks, documents);
        }
    }

    public static LegalPages fromMap(Map<String, Object> m) {
        if (m == null || m.isEmpty()) return EMPTY;
        var pages = new LinkedHashMap<String, LegalPage>();
        for (String kind : KINDS) pages.put(kind, LegalPage.fromMap(m.get(kind)));
        return new LegalPages(pages);
    }
    public Map<String, Object> toMap() {
        var out = new LinkedHashMap<String, Object>();
        pages.forEach((kind, page) -> out.put(kind, page.toMap()));
        return out;
    }

    /** Text as written, line breaks kept; angle brackets refused so nothing reads as markup. */
    private static String clean(String value, int max, String what) {
        String v = value == null ? "" : value.replace("\r\n", "\n").replaceAll("[ \\t\\u00a0]+", " ").replaceAll(" ?\\n ?", "\n").trim();
        if (v.length() > max) throw new IllegalArgumentException(what + " admite " + max + " caracteres");
        if (v.indexOf('<') >= 0 || v.indexOf('>') >= 0) throw new IllegalArgumentException(what + " solo admite texto");
        return v;
    }
}

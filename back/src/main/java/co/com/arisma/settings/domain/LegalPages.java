package co.com.arisma.settings.domain;
import java.util.*;
import java.util.regex.Pattern;

/**
 * The store's legal pages, written by the store itself: the terms of use and the personal data policy. Each page is plain
 * text in blocks (headings, paragraphs and lists, never HTML) plus the documents it attaches, such as the signed PDF of the
 * data policy. A page with no blocks and no documents is not published.
 */
public record LegalPages(LegalPage terms, LegalPage privacy) {
    public static final String KEY = "legal";
    public static final LegalPages EMPTY = new LegalPages(LegalPage.EMPTY, LegalPage.EMPTY);

    public LegalPages {
        terms = terms == null ? LegalPage.EMPTY : terms;
        privacy = privacy == null ? LegalPage.EMPTY : privacy;
    }

    /** The page by the name fronts use: "terms" or "privacy". */
    public Optional<LegalPage> page(String kind) {
        return switch (kind == null ? "" : kind) {
            case "terms" -> Optional.of(terms);
            case "privacy" -> Optional.of(privacy);
            default -> Optional.empty();
        };
    }
    /** Whether a file name is attached to either page: only those are served. */
    public boolean attaches(String file) {
        return terms.documents().stream().anyMatch(d -> d.file().equals(file)) || privacy.documents().stream().anyMatch(d -> d.file().equals(file));
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
        static LegalPage fromMap(Object o) {
            if (!(o instanceof Map<?, ?> m)) return EMPTY;
            List<Block> blocks = m.get("blocks") instanceof List<?> l ? l.stream().map(Block::fromMap).toList() : List.of();
            List<Document> documents = m.get("documents") instanceof List<?> l ? l.stream().map(Document::fromMap).toList() : List.of();
            return new LegalPage(Objects.toString(m.get("title"), ""), blocks, documents);
        }
    }

    public static LegalPages fromMap(Map<String, Object> m) {
        if (m == null || m.isEmpty()) return EMPTY;
        return new LegalPages(LegalPage.fromMap(m.get("terms")), LegalPage.fromMap(m.get("privacy")));
    }
    public Map<String, Object> toMap() {
        var out = new LinkedHashMap<String, Object>();
        out.put("terms", terms.toMap());
        out.put("privacy", privacy.toMap());
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

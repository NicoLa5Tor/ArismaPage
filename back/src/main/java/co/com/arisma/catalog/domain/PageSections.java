package co.com.arisma.catalog.domain;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

/**
 * Which blocks of the public product page are shown. A product states a choice only where it differs from the store:
 * everything else is inherited, so changing the store default reaches every product that did not decide.
 */
public record PageSections(Map<Section, Visibility> choices) {
    /** Blocks of the product page, in the order the page shows them. */
    public enum Section {
        BUY, WHATSAPP, STOCK, SKU, HIGHLIGHTS, DESCRIPTION, SPECS, AGE, CATEGORIES, SHIPPING, REVIEWS, QUESTIONS, RELATED;
        public String key() { return name().toLowerCase(Locale.ROOT); }
        public static Section parse(String key) {
            try { return valueOf(key.trim().toUpperCase(Locale.ROOT)); }
            catch (RuntimeException e) { throw new IllegalArgumentException("Sección de página desconocida: «" + key + "»"); }
        }
    }
    public enum Visibility {
        INHERIT, SHOW, HIDE;
        public String key() { return name().toLowerCase(Locale.ROOT); }
        public static Visibility parse(String key) {
            try { return key == null || key.isBlank() ? INHERIT : valueOf(key.trim().toUpperCase(Locale.ROOT)); }
            catch (IllegalArgumentException e) { throw new IllegalArgumentException("Cada sección se muestra, se oculta o usa el valor de la tienda"); }
        }
    }
    public static final PageSections INHERIT_ALL = new PageSections(Map.of());

    public PageSections {
        var kept = new EnumMap<Section, Visibility>(Section.class);
        if (choices != null) choices.forEach((section, visibility) -> { if (section != null && visibility != null && visibility != Visibility.INHERIT) kept.put(section, visibility); });
        choices = Map.copyOf(kept);
    }

    /** From the keys the panel and the database use ("reviews" → "hide"). Unknown keys are an error, not silently dropped. */
    public static PageSections parse(Map<String, String> raw) {
        var parsed = new EnumMap<Section, Visibility>(Section.class);
        if (raw != null) raw.forEach((key, value) -> parsed.put(Section.parse(key), Visibility.parse(value)));
        return new PageSections(parsed);
    }

    public Visibility of(Section section) { return choices.getOrDefault(section, Visibility.INHERIT); }

    /** Only the stated choices, by key, in page order: what is stored. */
    public Map<String, String> toKeys() {
        var out = new LinkedHashMap<String, String>();
        for (Section section : Section.values()) if (choices.containsKey(section)) out.put(section.key(), choices.get(section).key());
        return out;
    }

    /**
     * What the page really shows: this product's choice, else the store's, else shown.
     * In the store defaults INHERIT has nothing above it, so only HIDE hides.
     */
    public Map<String, Boolean> resolve(PageSections store) {
        var out = new LinkedHashMap<String, Boolean>();
        for (Section section : Section.values()) {
            Visibility own = of(section);
            Visibility effective = own != Visibility.INHERIT ? own : store == null ? Visibility.SHOW : store.of(section);
            out.put(section.key(), effective != Visibility.HIDE);
        }
        return out;
    }
}

package co.com.arisma.catalog.domain;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;

/**
 * The content of a product's public page: a one-paragraph summary, the long description (HTML already cleaned by the
 * application), a few highlights, a data sheet and which sections are shown.
 */
public record ProductPage(String shortDescription, String descriptionHtml, List<String> highlights, List<Spec> specs, PageSections sections) {
    public static final int MAX_SHORT = 300, MAX_DESCRIPTION = 20_000, MAX_HIGHLIGHTS = 6, MAX_HIGHLIGHT = 120, MAX_SPECS = 20, MAX_LABEL = 40, MAX_VALUE = 160;

    /** One row of the data sheet, e.g. "Material" → "Madera con bordes redondeados". */
    public record Spec(String label, String value) {
        public Spec {
            label = plain(label, "El nombre de cada dato de la ficha");
            value = plain(value, "El valor de cada dato de la ficha");
            if (label.isEmpty() || value.isEmpty()) throw new IllegalArgumentException("Cada dato de la ficha lleva nombre y valor");
            if (label.length() > MAX_LABEL) throw new IllegalArgumentException("El nombre de un dato admite máximo " + MAX_LABEL + " caracteres");
            if (value.length() > MAX_VALUE) throw new IllegalArgumentException("El valor de un dato admite máximo " + MAX_VALUE + " caracteres");
        }
    }

    public ProductPage {
        shortDescription = plain(shortDescription, "La descripción corta");
        if (shortDescription.length() > MAX_SHORT) throw new IllegalArgumentException("La descripción corta admite máximo " + MAX_SHORT + " caracteres");
        descriptionHtml = descriptionHtml == null ? "" : descriptionHtml.trim();
        if (descriptionHtml.length() > MAX_DESCRIPTION) throw new IllegalArgumentException("La descripción admite máximo " + MAX_DESCRIPTION + " caracteres");
        var unique = new LinkedHashSet<String>();
        for (String highlight : highlights == null ? List.<String>of() : highlights) {
            String text = plain(highlight, "Cada destacado");
            if (text.isEmpty()) continue;
            if (text.length() > MAX_HIGHLIGHT) throw new IllegalArgumentException("Cada destacado admite máximo " + MAX_HIGHLIGHT + " caracteres");
            unique.add(text);
        }
        if (unique.size() > MAX_HIGHLIGHTS) throw new IllegalArgumentException("Máximo " + MAX_HIGHLIGHTS + " destacados");
        highlights = List.copyOf(new ArrayList<>(unique));
        specs = specs == null ? List.of() : List.copyOf(specs);
        if (specs.size() > MAX_SPECS) throw new IllegalArgumentException("La ficha admite máximo " + MAX_SPECS + " datos");
        if (specs.stream().map(spec -> spec.label().toLowerCase(java.util.Locale.ROOT)).distinct().count() != specs.size()) throw new IllegalArgumentException("La ficha repite un dato");
        sections = sections == null ? PageSections.INHERIT_ALL : sections;
    }

    private static final java.util.regex.Pattern TAG = java.util.regex.Pattern.compile("<\\s*[/!]?\\s*[a-zA-Z]");
    /** Plain text only: these fields are printed as text, so markup in them is a mistake worth telling the admin about. */
    private static String plain(String raw, String what) {
        String text = raw == null ? "" : raw.trim().replaceAll("\\s+", " ");
        if (TAG.matcher(text).find()) throw new IllegalArgumentException(what + " es solo texto, sin etiquetas");
        return text;
    }
}

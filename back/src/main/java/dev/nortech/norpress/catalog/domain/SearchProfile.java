package dev.nortech.norpress.catalog.domain;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * What helps shoppers find a category or a product: the words they use for it ("puzzle" for a jigsaw) and the ages
 * it is for. Keywords are stored trimmed and in lower case, without repeats; an age range is given whole or not at all.
 */
public record SearchProfile(List<String> keywords, Integer ageMin, Integer ageMax) {
    public static final int MAX_KEYWORDS = 40;
    public static final int MIN_LENGTH = 2;
    public static final int MAX_LENGTH = 40;
    public static final int MAX_AGE = 99;
    /** Letters (accented too), digits and single spaces: a keyword is a word or a short phrase, never markup. */
    private static final Pattern ALLOWED = Pattern.compile("[\\p{L}\\p{N}]+( [\\p{L}\\p{N}]+)*");

    public SearchProfile {
        keywords = clean(keywords);
        if ((ageMin == null) != (ageMax == null)) throw new IllegalArgumentException("Indica la edad desde y hasta, o deja las dos vacías");
        if (ageMin != null && (ageMin < 0 || ageMax > MAX_AGE || ageMin > ageMax)) throw new IllegalArgumentException("El rango de edad debe ir de 0 a " + MAX_AGE + " años, con el desde menor o igual al hasta");
    }

    private static List<String> clean(List<String> raw) {
        var unique = new LinkedHashSet<String>();
        for (String keyword : raw == null ? List.<String>of() : raw) {
            if (keyword == null) continue;
            String word = keyword.trim().replaceAll("\\s+", " ").toLowerCase(Locale.ROOT);
            if (word.isEmpty()) continue;
            if (word.length() < MIN_LENGTH || word.length() > MAX_LENGTH) throw new IllegalArgumentException("Cada palabra clave debe tener entre " + MIN_LENGTH + " y " + MAX_LENGTH + " caracteres: «" + word + "»");
            if (!ALLOWED.matcher(word).matches()) throw new IllegalArgumentException("Las palabras clave solo llevan letras, números y espacios: «" + word + "»");
            unique.add(word);
        }
        if (unique.size() > MAX_KEYWORDS) throw new IllegalArgumentException("Máximo " + MAX_KEYWORDS + " palabras clave");
        return List.copyOf(new ArrayList<>(unique));
    }
}

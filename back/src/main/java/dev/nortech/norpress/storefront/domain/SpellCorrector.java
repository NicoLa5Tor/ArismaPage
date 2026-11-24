package dev.nortech.norpress.storefront.domain;
import java.text.Normalizer;
import java.util.*;
import java.util.regex.Pattern;

/**
 * Corrects a catalog search against the store's own words: a word the catalog does not use is replaced by the catalog
 * word it sounds like in Spanish ("ronpecabesas" → "rompecabezas", "girafa" → "jirafa") or is a typo or two away from.
 * No dictionary: what the store sells is the vocabulary, so it works for any store and any line of business.
 */
public final class SpellCorrector {
    /** Spanish connecting words: never searched for, never corrected. Language, not store data. */
    static final Set<String> CONNECTORS = Set.of("a", "al", "de", "del", "el", "la", "las", "los", "lo", "en", "con", "sin", "para", "por", "un", "una", "unos", "unas", "y", "o", "e", "u");
    private static final Pattern MARKS = Pattern.compile("\\p{M}+");
    private static final Pattern NOT_WORD = Pattern.compile("[^a-z0-9]+");
    public static final SpellCorrector EMPTY = new SpellCorrector(Map.of());

    public record Change(String from, String to) {}
    /** The text to search and what was changed; no changes means the text is the shopper's own, folded. */
    public record Correction(String text, List<Change> changes) {
        public boolean changed() { return !changes.isEmpty(); }
    }

    private final Map<String, Integer> frequency;
    private final Map<String, String> bySound = new HashMap<>();
    private final Map<String, String> keyOf = new HashMap<>();

    /** `vocabulary`: each catalog word (any case, accents allowed) and how often the catalog uses it. */
    public SpellCorrector(Map<String, Integer> vocabulary) {
        var counts = new HashMap<String, Integer>();
        vocabulary.forEach((word, n) -> { for (var w : words(word)) if (w.length() >= 3 && !isNumber(w)) counts.merge(w, n, Integer::sum); });
        frequency = Map.copyOf(counts);
        for (var w : frequency.keySet()) {
            var key = soundKey(w);
            keyOf.put(w, key);
            bySound.merge(key, w, (a, b) -> better(a, b));
        }
    }

    /** Lowercase, accent-free words of a text. */
    public static List<String> words(String text) {
        if (text == null || text.isBlank()) return List.of();
        var folded = MARKS.matcher(Normalizer.normalize(text.toLowerCase(Locale.ROOT), Normalizer.Form.NFD)).replaceAll("");
        return Arrays.stream(NOT_WORD.split(folded)).filter(w -> !w.isEmpty()).toList();
    }

    /** The words worth searching for: connectors are left out. */
    public static List<String> searchWords(String text) { return words(text).stream().filter(w -> !CONNECTORS.contains(w)).toList(); }

    /**
     * How a Spanish word sounds, so spellings that read the same meet: silent h, b/v, s/z/soft c, k/qu/hard c,
     * y/ll, j/soft g, and doubled letters.
     */
    static String soundKey(String word) {
        var w = word.replace("ch", "\u0001").replace("h", "").replace("\u0001", "ch");
        w = w.replaceAll("gu([ei])", "\u0002$1").replaceAll("g([ei])", "j$1").replace("\u0002", "g");
        w = w.replaceAll("qu([ei])", "k$1").replaceAll("c([ei])", "s$1").replace("ch", "\u0001").replace("c", "k").replace("\u0001", "ch");
        w = w.replace("z", "s").replace("v", "b").replace("ll", "y").replace("w", "u");
        return w.replaceAll("(.)\\1+", "$1");
    }

    public Correction correct(String text) {
        var out = new ArrayList<String>();
        var changes = new ArrayList<Change>();
        for (var word : words(text)) {
            var fixed = fix(word);
            if (!fixed.equals(word)) changes.add(new Change(word, fixed));
            out.add(fixed);
        }
        return new Correction(String.join(" ", out), List.copyOf(changes));
    }

    private String fix(String word) {
        if (frequency.isEmpty() || word.length() < 4 || isNumber(word) || CONNECTORS.contains(word) || known(word)) return word;
        var key = soundKey(word);
        var same = bySound.get(key);
        if (same != null) return same;
        // a short word is a letter away from too many others; only its sound is trusted
        if (word.length() < 5) return word;
        int allowed = word.length() >= 10 ? 2 : 1;
        String best = null;
        int bestDistance = allowed + 1;
        for (var entry : keyOf.entrySet()) {
            if (entry.getKey().length() < 4) continue;
            int d = distance(key, entry.getValue(), allowed);
            if (d <= allowed && (best == null || d < bestDistance || (d == bestDistance && better(entry.getKey(), best).equals(entry.getKey())))) { best = entry.getKey(); bestDistance = d; }
        }
        return best == null ? word : best;
    }

    /** The catalog uses it, alone or inside a longer word ("cabezas" in "rompecabezas"): the search already finds it. */
    private boolean known(String word) {
        if (frequency.containsKey(word)) return true;
        for (var w : frequency.keySet()) if (w.length() > word.length() && w.contains(word)) return true;
        return false;
    }

    /** The more used word wins a tie; then the shorter, then the first alphabetically, so the choice is stable. */
    private String better(String a, String b) {
        int fa = frequency.getOrDefault(a, 0), fb = frequency.getOrDefault(b, 0);
        if (fa != fb) return fa > fb ? a : b;
        if (a.length() != b.length()) return a.length() < b.length() ? a : b;
        return a.compareTo(b) <= 0 ? a : b;
    }

    private static boolean isNumber(String w) { return w.chars().allMatch(Character::isDigit); }

    /** Edit distance where two swapped neighbours count as one, or `max + 1` as soon as it is known to be larger. */
    static int distance(String a, String b, int max) {
        if (Math.abs(a.length() - b.length()) > max) return max + 1;
        int[][] d = new int[a.length() + 1][b.length() + 1];
        for (int i = 0; i <= a.length(); i++) d[i][0] = i;
        for (int j = 0; j <= b.length(); j++) d[0][j] = j;
        for (int i = 1; i <= a.length(); i++) {
            int rowBest = Integer.MAX_VALUE;
            for (int j = 1; j <= b.length(); j++) {
                int cost = a.charAt(i - 1) == b.charAt(j - 1) ? 0 : 1;
                int v = Math.min(Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1), d[i - 1][j - 1] + cost);
                if (i > 1 && j > 1 && a.charAt(i - 1) == b.charAt(j - 2) && a.charAt(i - 2) == b.charAt(j - 1)) v = Math.min(v, d[i - 2][j - 2] + 1);
                d[i][j] = v;
                rowBest = Math.min(rowBest, v);
            }
            if (rowBest > max) return max + 1;
        }
        return d[a.length()][b.length()];
    }
}

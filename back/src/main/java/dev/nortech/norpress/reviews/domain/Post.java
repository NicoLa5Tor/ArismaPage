package dev.nortech.norpress.reviews.domain;
import java.util.Locale;
import java.util.regex.Pattern;

/** What a shopper writes about a product: a review carries a rating from 1 to 5, a question does not. Text only. */
public record Post(Kind kind, Integer rating, String body) {
    public enum Kind {
        REVIEW, QUESTION;
        public String db() { return name().toLowerCase(Locale.ROOT); }
        public static Kind parse(String value) {
            try { return valueOf(value.trim().toUpperCase(Locale.ROOT)); } catch (RuntimeException e) { throw new IllegalArgumentException("Elige si es una opinión o una pregunta"); }
        }
    }
    public enum Status {
        PENDING, PUBLISHED, HIDDEN;
        public String db() { return name().toLowerCase(Locale.ROOT); }
        public static Status parse(String value) {
            try { return valueOf(value.trim().toUpperCase(Locale.ROOT)); } catch (RuntimeException e) { throw new IllegalArgumentException("Estado inválido"); }
        }
    }
    public static final int MIN_REVIEW = 10, MAX_REVIEW = 2000, MIN_QUESTION = 8, MAX_QUESTION = 600, MIN_REPLY = 2, MAX_REPLY = 1500;
    private static final Pattern TAG = Pattern.compile("<\\s*[/!]?\\s*[a-zA-Z]");
    private static final Pattern LINK = Pattern.compile("(?i)https?://|www\\.");

    public Post {
        if (kind == null) throw new IllegalArgumentException("Elige si es una opinión o una pregunta");
        if (kind == Kind.REVIEW) {
            if (rating == null || rating < 1 || rating > 5) throw new IllegalArgumentException("Califica de 1 a 5 estrellas");
            body = text(body, MIN_REVIEW, MAX_REVIEW, "Cuéntanos tu opinión");
        } else {
            rating = null;
            body = text(body, MIN_QUESTION, MAX_QUESTION, "Escribe tu pregunta");
        }
    }
    public static String reply(String body) { return text(body, MIN_REPLY, MAX_REPLY, "Escribe la respuesta"); }

    /** Line breaks are kept (at most two in a row); markup and links are refused, since posts are shown as plain text to everyone. */
    static String text(String raw, int min, int max, String what) {
        String body = raw == null ? "" : raw.replace("\r", "").replaceAll("[ \\t]+", " ").replaceAll("\\n{3,}", "\n\n").trim();
        if (body.length() < min) throw new IllegalArgumentException(what + " (mínimo " + min + " caracteres)");
        if (body.length() > max) throw new IllegalArgumentException("El texto admite máximo " + max + " caracteres");
        if (TAG.matcher(body).find()) throw new IllegalArgumentException("Escribe solo texto, sin etiquetas");
        if (LINK.matcher(body).find()) throw new IllegalArgumentException("No se permiten enlaces en opiniones ni preguntas");
        return body;
    }
    /** The name shown next to a post: first name and the initial of the last one, so full names are not published. */
    public static String publicName(String fullName) {
        String[] parts = fullName == null ? new String[0] : fullName.trim().split("\\s+");
        if (parts.length == 0 || parts[0].isEmpty()) return "Cliente";
        return parts.length == 1 ? parts[0] : parts[0] + " " + parts[parts.length - 1].substring(0, 1).toUpperCase(Locale.ROOT) + ".";
    }
}

package dev.nortech.norpress.notifications.domain;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * An email the store writes: who it is for, what it says in plain text and the same in simple HTML, and the files it
 * carries (only where they are kept: the bytes are read when it is sent).
 */
public record Message(String kind, String to, String subject, String text, String html, List<Attachment> attachments) {
    /** A file sent with the email: the name the customer sees, where it is stored and its type. */
    public record Attachment(String name, String key, String contentType) {
        public Attachment {
            if (name == null || name.isBlank() || name.length() > 120 || name.contains("/") || name.contains("\\")) throw new IllegalArgumentException("Nombre de adjunto inválido");
            if (key == null || key.isBlank()) throw new IllegalArgumentException("Adjunto sin archivo");
            if (contentType == null || contentType.isBlank()) throw new IllegalArgumentException("Adjunto sin tipo");
        }
    }
    public Message(String kind, String to, String subject, String text, String html) { this(kind, to, subject, text, html, List.of()); }
    public Message withAttachments(List<Attachment> files) { return new Message(kind, to, subject, text, html, files); }
    private static final Pattern EMAIL = Pattern.compile("[^@\\s<>]+@[^@\\s<>]+\\.[^@\\s<>]{2,}");
    public Message {
        to = to == null ? "" : to.trim().toLowerCase(Locale.ROOT);
        if (!EMAIL.matcher(to).matches() || to.length() > 254) throw new IllegalArgumentException("Correo de destino inválido");
        if (kind == null || kind.isBlank()) throw new IllegalArgumentException("Tipo de correo requerido");
        if (subject == null || subject.isBlank() || subject.length() > 200 || subject.contains("\n") || subject.contains("\r")) throw new IllegalArgumentException("Asunto inválido");
        if (text == null || html == null) throw new IllegalArgumentException("Contenido requerido");
        attachments = attachments == null ? List.of() : List.copyOf(attachments);
        if (attachments.size() > 5) throw new IllegalArgumentException("Demasiados adjuntos");
    }
}

package dev.nortech.norpress.notifications.domain;

/**
 * How the store signs its emails: its name at the top, its colour on the button, a one-line signature at the foot and,
 * under it, who sells (legal name, NIT, contact email) as the consumer law asks, with where its terms are.
 */
public record Brand(String name, String signature, String color, String legal) {
    public Brand {
        name = name == null || name.isBlank() ? "Tu tienda" : name.trim();
        signature = signature == null || signature.isBlank() ? name : signature.trim();
        color = color == null || !color.matches("#[0-9a-fA-F]{6}") ? "#1d1a23" : color;
        legal = legal == null ? "" : legal.trim();
    }
    public Brand(String name, String signature, String color) { this(name, signature, color, ""); }
}

package co.com.arisma.notifications.domain;

/** How the store signs its emails: its name at the top, its colour on the button, and a one-line signature at the foot. */
public record Brand(String name, String signature, String color) {
    public Brand {
        name = name == null || name.isBlank() ? "Tu tienda" : name.trim();
        signature = signature == null || signature.isBlank() ? name : signature.trim();
        color = color == null || !color.matches("#[0-9a-fA-F]{6}") ? "#1d1a23" : color;
    }
}

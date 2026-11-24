package dev.nortech.norpress.settings.domain;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * The mail server the store sends with (any SMTP provider: Brevo, Google Workspace, Amazon SES…). The password is not
 * here: it is sealed apart. Without a host the store still writes every email to its outbox, it just does not send them.
 * storeInbox is where new-order notices for the team go. An empty fromName sends with the store's name.
 */
public record MailSettings(String host, int port, Security security, String username, String fromAddress, String fromName, String storeInbox) {
    public static final String KEY = "mail";
    public enum Security { STARTTLS, SSL, NONE }
    public static final MailSettings DEFAULT = new MailSettings("", 587, Security.STARTTLS, "", "", "", "");
    private static final Pattern EMAIL = Pattern.compile("[^@\\s<>]+@[^@\\s<>]+\\.[^@\\s<>]{2,}");
    private static final Pattern HOST = Pattern.compile("[A-Za-z0-9.-]{1,253}");

    public MailSettings {
        host = clean(host); username = clean(username); fromAddress = clean(fromAddress).toLowerCase(Locale.ROOT); storeInbox = clean(storeInbox).toLowerCase(Locale.ROOT);
        fromName = clean(fromName);
        if (security == null) security = Security.STARTTLS;
        if (!host.isEmpty() && !HOST.matcher(host).matches()) throw new IllegalArgumentException("El servidor de correo no es válido");
        if (port < 1 || port > 65535) throw new IllegalArgumentException("El puerto va de 1 a 65535");
        if (!host.isEmpty() && !EMAIL.matcher(fromAddress).matches()) throw new IllegalArgumentException("Escribe el correo remitente, por ejemplo pedidos@tutienda.com");
        if (!storeInbox.isEmpty() && !EMAIL.matcher(storeInbox).matches()) throw new IllegalArgumentException("El correo de avisos de la tienda no es válido");
        if (fromName.length() > 60 || fromName.indexOf('<') >= 0) throw new IllegalArgumentException("El nombre del remitente admite 60 caracteres, solo texto");
    }
    public boolean configured() { return !host.isEmpty(); }

    public static MailSettings fromMap(Map<String, Object> m) {
        if (m == null || m.isEmpty()) return DEFAULT;
        Security security;
        try { security = Security.valueOf(String.valueOf(m.getOrDefault("security", "STARTTLS")).toUpperCase(Locale.ROOT)); } catch (IllegalArgumentException e) { security = Security.STARTTLS; }
        int port = m.get("port") instanceof Number n ? n.intValue() : 587;
        return new MailSettings(text(m, "host"), port, security, text(m, "username"), text(m, "fromAddress"), text(m, "fromName"), text(m, "storeInbox"));
    }
    public Map<String, Object> toMap() {
        var out = new LinkedHashMap<String, Object>();
        out.put("host", host); out.put("port", port); out.put("security", security.name()); out.put("username", username);
        out.put("fromAddress", fromAddress); out.put("fromName", fromName); out.put("storeInbox", storeInbox);
        return out;
    }
    private static String text(Map<String, Object> m, String key) { return m.get(key) == null ? "" : String.valueOf(m.get(key)); }
    private static String clean(String value) { return value == null ? "" : value.trim(); }
}

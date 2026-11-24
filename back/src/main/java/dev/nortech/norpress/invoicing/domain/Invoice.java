package dev.nortech.norpress.invoicing.domain;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * The invoice of an order, as the store sends it: a PDF made in the store's own billing program, an optional number,
 * and whether it was already sent (and how) or the order does not need one.
 */
public record Invoice(Status status, String number, String fileName, String objectKey, String token, List<String> channels) {
    public enum Status { UPLOADED, SENT, NOT_NEEDED;
        public String db() { return name().toLowerCase(java.util.Locale.ROOT); }
        public static Status fromDb(String value) { return valueOf(value.toUpperCase(java.util.Locale.ROOT)); }
    }
    public static final String EMAIL = "email", WHATSAPP = "whatsapp";
    public static final int MAX_BYTES = 10 * 1024 * 1024;
    /** Order statuses an invoice can go with: paid ones. Cancelled, failed or refunded orders are not invoiced here. */
    private static final Set<String> INVOICEABLE = Set.of("processing", "completed", "on_hold");
    private static final Pattern NUMBER = Pattern.compile("[\\p{L}\\p{N} ._/#-]{1,40}");

    public Invoice { channels = channels == null ? List.of() : List.copyOf(channels); }

    public boolean sent() { return status == Status.SENT; }
    public boolean hasFile() { return objectKey != null && token != null; }

    /** The file must really be a PDF (not just named like one) and not too heavy to email. */
    public static void requirePdf(byte[] bytes) {
        if (bytes == null || bytes.length == 0) throw new IllegalArgumentException("Elige el PDF de la factura");
        if (bytes.length > MAX_BYTES) throw new IllegalArgumentException("El PDF pesa más de 10 MB; exporta la factura más liviana");
        if (bytes.length < 5 || !new String(bytes, 0, 5, StandardCharsets.US_ASCII).equals("%PDF-")) throw new IllegalArgumentException("El archivo no es un PDF");
    }

    /** The invoice number as the store wrote it ("FV 1234"), or null when left blank. */
    public static String number(String value) {
        if (value == null || value.isBlank()) return null;
        var trimmed = value.trim().replaceAll("\\s+", " ");
        if (!NUMBER.matcher(trimmed).matches()) throw new IllegalArgumentException("El número de factura tiene máximo 40 caracteres: letras, números, espacios y . _ / # -");
        return trimmed;
    }

    /** The name the customer sees: "Factura FV-1234.pdf", or after the order when there is no number. */
    public static String fileName(String number, String orderNumber) {
        var base = number != null ? number : "pedido " + orderNumber;
        return "Factura " + base.replaceAll("[^\\p{L}\\p{N} ._-]", "-") + ".pdf";
    }

    public static void requireInvoiceable(String orderStatus) {
        if (!INVOICEABLE.contains(orderStatus)) throw new IllegalArgumentException("Solo se envía factura de pedidos pagados");
    }
}

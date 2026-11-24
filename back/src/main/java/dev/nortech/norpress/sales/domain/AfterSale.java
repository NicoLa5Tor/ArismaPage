package dev.nortech.norpress.sales.domain;
import java.math.BigDecimal;
import java.util.Locale;
import java.util.Set;

/**
 * What happens to an order after the sale: the shopper asking to cancel it, and the money the store gives back.
 * Pure rules; the store records refunds it made itself (in the gateway's dashboard, by transfer or in cash).
 */
public final class AfterSale {
    private AfterSale() {}
    static final int MAX_TEXT = 500;

    /** Stages (v_order_stage) in which the shopper can cancel: nothing has left the store (for pickup: not picked up). */
    static final Set<String> CANCELLABLE = Set.of("unpaid", "to_prepare", "packed");

    public static boolean canAskToCancel(OrderStatus status, String stage) {
        return open(status) && CANCELLABLE.contains(stage);
    }
    /**
     * The store also cancels orders that need attention (on hold, or a delivery that failed and came back): it knows
     * where the package is. Never one on its way or delivered.
     */
    public static boolean storeCanCancel(OrderStatus status, String stage) {
        return open(status) && (CANCELLABLE.contains(stage) || "issue".equals(stage));
    }
    private static boolean open(OrderStatus status) { return status == OrderStatus.PENDING || status == OrderStatus.ON_HOLD || status == OrderStatus.PROCESSING; }
    /** The shopper's reason, required and trimmed. */
    public static String reason(String text) {
        String clean = text == null ? "" : text.trim().replaceAll("\\s+", " ");
        if (clean.length() < 3) throw new IllegalArgumentException("Cuéntanos por qué quieres cancelar el pedido");
        if (clean.length() > MAX_TEXT) throw new IllegalArgumentException("El motivo es demasiado largo (máximo " + MAX_TEXT + " caracteres)");
        return clean;
    }
    /** The store's answer: required when it says no, so the shopper knows why. */
    public static String answer(String text, boolean rejecting) {
        String clean = text == null ? "" : text.trim();
        if (rejecting && clean.length() < 3) throw new IllegalArgumentException("Explícale al cliente por qué no se puede cancelar");
        if (clean.length() > MAX_TEXT) throw new IllegalArgumentException("La respuesta es demasiado larga (máximo " + MAX_TEXT + " caracteres)");
        return clean;
    }

    public enum Method {
        GATEWAY("por la pasarela de pago"), TRANSFER("por transferencia"), CASH("en efectivo"), OTHER("por otro medio");
        public final String label;
        Method(String label) { this.label = label; }
        public String db() { return name().toLowerCase(Locale.ROOT); }
        public static Method parse(String value) {
            if (value == null || value.isBlank()) throw new IllegalArgumentException("Indica cómo devolviste el dinero");
            try { return valueOf(value.trim().toUpperCase(Locale.ROOT)); } catch (IllegalArgumentException e) { throw new IllegalArgumentException("Medio de devolución inválido"); }
        }
        public static Method fromDb(String value) { return valueOf(value.toUpperCase(Locale.ROOT)); }
    }

    /** A refund the store made: whole pesos, up to what is still to give back. */
    public record Refund(BigDecimal amount, Method method, String reference, String note) {
        public Refund {
            if (amount == null || amount.signum() <= 0) throw new IllegalArgumentException("Escribe cuánto devolviste");
            if (amount.stripTrailingZeros().scale() > 0) throw new IllegalArgumentException("Escribe el valor en pesos, sin centavos");
            if (method == null) throw new IllegalArgumentException("Indica cómo devolviste el dinero");
            reference = reference == null ? "" : reference.trim();
            note = note == null ? "" : note.trim();
            if (reference.length() > 120) throw new IllegalArgumentException("La referencia es demasiado larga");
            if (note.length() > MAX_TEXT) throw new IllegalArgumentException("La nota es demasiado larga");
        }
        /** Refusing more than what was paid and not returned yet. */
        public void requireWithin(BigDecimal paid, BigDecimal alreadyRefunded) {
            BigDecimal left = paid.subtract(alreadyRefunded);
            if (left.signum() <= 0) throw new IllegalArgumentException("Ya se devolvió todo lo que se pagó por este pedido");
            if (amount.compareTo(left) > 0) throw new IllegalArgumentException("Solo queda por devolver " + pesos(left));
        }
    }

    /** "$ 12.345", as the store writes money. */
    public static String pesos(BigDecimal value) {
        var symbols = java.text.DecimalFormatSymbols.getInstance(Locale.ROOT);
        symbols.setGroupingSeparator('.');
        return "$ " + new java.text.DecimalFormat("#,##0", symbols).format(value.setScale(0, java.math.RoundingMode.HALF_UP));
    }
}

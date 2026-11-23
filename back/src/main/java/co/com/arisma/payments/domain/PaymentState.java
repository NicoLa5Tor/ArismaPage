package co.com.arisma.payments.domain;
import java.util.Locale;

/** Where a payment try stands, whatever the gateway calls it. */
public enum PaymentState {
    STARTED, PENDING, APPROVED, DECLINED, VOIDED, ERROR;
    public String db() { return name().toLowerCase(Locale.ROOT); }
    public static PaymentState fromDb(String value) { return valueOf(value.toUpperCase(Locale.ROOT)); }
    /** Wompi: PENDING, APPROVED, DECLINED, VOIDED, ERROR. */
    public static PaymentState ofWompi(String status) {
        return switch (status == null ? "" : status.trim().toUpperCase(Locale.ROOT)) {
            case "APPROVED" -> APPROVED; case "DECLINED" -> DECLINED; case "VOIDED" -> VOIDED; case "PENDING" -> PENDING; default -> ERROR;
        };
    }
    /** PayU transactionState / state_pol: 4 approved, 6 declined, 5 expired, 7 pending, 104 error. */
    public static PaymentState ofPayu(String code) {
        return switch (code == null ? "" : code.trim()) {
            case "4" -> APPROVED; case "6" -> DECLINED; case "5" -> VOIDED; case "7" -> PENDING; default -> ERROR;
        };
    }
    /**
     * What to tell the shopper and the team: the gateway's own reason when it gives one ("Número no válido en Sandbox",
     * "Fondos insuficientes"), after the plain message. The reason is the gateway's text: kept short and on one line.
     */
    public String message(String gatewayReason) {
        if (this == APPROVED || gatewayReason == null) return message();
        var reason = gatewayReason.replaceAll("[\\p{Cntrl}<>]", " ").replaceAll("\\s+", " ").trim();
        if (reason.isEmpty()) return message();
        if (reason.length() > 160) reason = reason.substring(0, 160).trim() + "…";
        return message() + ": " + reason;
    }
    public String message() {
        return switch (this) {
            case APPROVED -> "Pago aprobado"; case DECLINED -> "El pago fue rechazado"; case VOIDED -> "El pago se anuló o venció";
            case PENDING, STARTED -> "El pago está en proceso"; case ERROR -> "Hubo un error con el pago";
        };
    }
}

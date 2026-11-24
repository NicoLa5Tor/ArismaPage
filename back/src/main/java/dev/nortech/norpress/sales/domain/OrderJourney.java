package dev.nortech.norpress.sales.domain;
import java.time.Instant;
import java.util.*;

/**
 * What the shopper sees of their order's history: the steps it went through, in their words, each with its date.
 * It is built from the recorded changes (the order's status, each delivery step, the invoice) and leaves out what is
 * the store's own work: internal notes, method changes, staff names and corrections that went back a step.
 */
public final class OrderJourney {
    private OrderJourney() {}

    /**
     * source: "order", "shipment", "invoice", "cancel_request" or "refund"; from and to are the recorded statuses (from is
     * null for the first one). detail is what the shopper may read with it: the store's answer to a request, a refund's
     * amount and method.
     */
    public record Change(String source, String from, String to, Instant at, String detail) {
        public Change(String source, String from, String to, Instant at) { this(source, from, to, at, ""); }
    }
    /** How the order travels and with whom, to word the delivery steps. method: carrier, courier or pickup. */
    public record Delivery(String method, String carrier, String trackingCode) {
        public static final Delivery NONE = new Delivery(null, null, null);
    }
    /** tone: good, info or bad. */
    public record Step(String key, String title, String detail, Instant at, String tone) {}

    /** The steps in the order they happened. */
    public static List<Step> of(List<Change> changes, Delivery delivery) {
        var sorted = new ArrayList<>(changes);
        // at the same moment, the refund that completes the money comes before "all of it was given back"
        sorted.sort(Comparator.comparing(Change::at).thenComparing(c -> "order".equals(c.source()) && "refunded".equals(c.to()) ? 1 : 0));
        var steps = new ArrayList<Step>();
        for (var c : sorted) {
            Step step = switch (c.source()) {
                case "order" -> order(c);
                case "shipment" -> shipment(c, delivery);
                case "invoice" -> new Step("invoice", "Tu factura está lista", "Puedes descargarla en esta página.", c.at(), "info");
                case "cancel_request" -> switch (c.to()) {
                    case "requested" -> new Step("cancel_requested", "Pediste cancelar el pedido", "La tienda te responde pronto.", c.at(), "info");
                    case "rejected" -> new Step("cancel_rejected", "No se pudo cancelar el pedido", c.detail() == null ? "" : c.detail(), c.at(), "bad");
                    default -> null; // approved: the order's own "cancelled" step says it
                };
                case "refund" -> switch (c.to()) {
                    case "done" -> new Step("refund", "Te devolvimos dinero", c.detail() == null ? "" : c.detail(), c.at(), "good");
                    case "started" -> new Step("refund_started", "Estamos devolviendo tu dinero", c.detail() == null ? "" : c.detail(), c.at(), "info");
                    case "transfer" -> new Step("refund_transfer", "Te lo devolveremos por transferencia", c.detail() == null ? "" : c.detail(), c.at(), "info");
                    default -> null;
                };
                default -> null;
            };
            if (step == null) continue;
            // the same step twice in a row (a correction redone) is shown once, at its first date
            if (!steps.isEmpty() && steps.getLast().key().equals(step.key()) && !step.key().equals("refund")) continue;
            steps.add(step);
        }
        // an order closed by its delivery already says it was delivered
        if (steps.stream().anyMatch(s -> s.key().equals("delivered"))) steps.removeIf(s -> s.key().equals("completed"));
        return steps;
    }

    /** The newest step, or null when there is none. */
    public static Step latest(List<Step> steps) { return steps.isEmpty() ? null : steps.getLast(); }

    private static Step order(Change c) {
        if (Objects.equals(c.from(), c.to())) return null;
        String to = c.to();
        if (c.from() == null) return new Step("placed", "Recibimos tu pedido", "", c.at(), "info");
        return switch (to) {
            case "processing" -> "on_hold".equals(c.from())
                ? new Step("resumed", "Tu pedido sigue en marcha", "", c.at(), "good")
                : new Step("paid", "Pago confirmado", "", c.at(), "good");
            case "on_hold" -> new Step("on_hold", "Pedido en revisión", "Te escribimos si necesitamos algo.", c.at(), "info");
            case "completed" -> new Step("completed", "Pedido completado", "", c.at(), "good");
            case "cancelled" -> new Step("cancelled", "Pedido cancelado", "", c.at(), "bad");
            case "failed" -> new Step("failed", "El pago no se completó", "No se hizo ningún cobro.", c.at(), "bad");
            case "refunded" -> new Step("refunded", "Te devolvimos todo el dinero", "", c.at(), "good");
            case "pending" -> new Step("pending", "Pedido esperando el pago", "", c.at(), "info");
            default -> null;
        };
    }

    private static Step shipment(Change c, Delivery d) {
        if (Objects.equals(c.from(), c.to())) return null;
        boolean pickup = "pickup".equals(d.method());
        return switch (c.to()) {
            case "packed" -> pickup
                ? new Step("packed", "Listo para recoger en la tienda", "", c.at(), "good")
                : new Step("packed", "Empacamos tu pedido", "", c.at(), "info");
            case "shipped" -> "carrier".equals(d.method()) && d.carrier() != null && !d.carrier().isBlank()
                ? new Step("shipped", "Salió con " + d.carrier().trim(), d.trackingCode() == null || d.trackingCode().isBlank() ? "" : "Guía " + d.trackingCode().trim(), c.at(), "info")
                : new Step("shipped", "Va en camino con nuestro mensajero", "", c.at(), "info");
            case "delivered" -> new Step("delivered", pickup ? "Recogiste tu pedido" : "Entregado", "", c.at(), "good");
            case "failed" -> new Step("not_delivered", "No se pudo entregar", "Te contactamos para volver a intentarlo.", c.at(), "bad");
            case "returned" -> new Step("returned", "El pedido volvió a la tienda", "", c.at(), "bad");
            default -> null; // back to pending, or cancelled along with the order
        };
    }
}

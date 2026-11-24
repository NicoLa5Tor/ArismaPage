package dev.nortech.norpress.fulfillment.domain;
import java.time.Instant;
import java.util.UUID;

/**
 * Delivery of one order. Moving it validates what each step needs:
 * a carrier shipment needs its tracking number, our own courier needs a person, a failed delivery needs the reason,
 * and nothing leaves the store unpaid unless it is cash on delivery.
 */
public record Shipment(UUID id, UUID orderId, DeliveryMethod method, FulfillmentStatus status, String carrier, String trackingCode, UUID courierUserId, String courierName,
                       String recipientName, String failureReason, Instant packedAt, Instant shippedAt, Instant deliveredAt) {
    /** Details the team types when moving the shipment; blank values keep what was already recorded. */
    public record Details(String carrier, String trackingCode, UUID courierUserId, String courierName, String recipientName, String reason) {
        public static Details none() { return new Details(null, null, null, null, null, null); }
    }
    /** What the order allows: paid, or cash on delivery (paid when handed over). */
    public record OrderState(boolean paid, boolean cashOnDelivery, boolean closed) {}

    public Shipment move(FulfillmentStatus next, Details d, OrderState order, Instant now) {
        if (next == null) throw new IllegalArgumentException("Indica el nuevo estado de entrega");
        if (!status.canMoveTo(next, method))
            throw new IllegalArgumentException(method == DeliveryMethod.PICKUP && next == FulfillmentStatus.SHIPPED ? "Un pedido para recoger en tienda no se envía: márcalo listo y luego entregado" : "No se puede pasar de " + status.label() + " a " + next.label());
        if (order.closed()) throw new IllegalArgumentException("El pedido está cancelado o fallido; no se puede despachar");
        boolean leaves = next == FulfillmentStatus.SHIPPED || next == FulfillmentStatus.DELIVERED;
        if (leaves && !order.paid() && !order.cashOnDelivery()) throw new IllegalArgumentException("El pedido no está pagado. Confirma el pago antes de despacharlo");
        var withDetails = withDetails(d);
        if (next == FulfillmentStatus.SHIPPED) {
            if (method == DeliveryMethod.CARRIER && (blank(withDetails.carrier) || blank(withDetails.trackingCode))) throw new IllegalArgumentException("Escribe la transportadora y el número de guía");
            if (method == DeliveryMethod.COURIER && withDetails.courierUserId == null && blank(withDetails.courierName)) throw new IllegalArgumentException("Indica quién lleva el pedido");
        }
        if (next == FulfillmentStatus.FAILED && blank(d.reason())) throw new IllegalArgumentException("Cuéntanos por qué no se entregó");
        return new Shipment(id, orderId, method, next, withDetails.carrier, withDetails.trackingCode, withDetails.courierUserId, withDetails.courierName,
            next == FulfillmentStatus.DELIVERED ? trimOrNull(d.recipientName()) : withDetails.recipientName,
            next == FulfillmentStatus.FAILED ? d.reason().trim() : next == FulfillmentStatus.SHIPPED ? null : withDetails.failureReason,
            next == FulfillmentStatus.PACKED ? now : withDetails.packedAt, next == FulfillmentStatus.SHIPPED ? now : withDetails.shippedAt, next == FulfillmentStatus.DELIVERED ? now : withDetails.deliveredAt);
    }
    /** Changing how it is delivered (or correcting the tracking number) is allowed until it is delivered or closed. */
    public Shipment reroute(DeliveryMethod newMethod, Details d) {
        if (!status.open()) throw new IllegalArgumentException("Este envío ya está " + status.label() + "; no se puede cambiar");
        if (newMethod == null) throw new IllegalArgumentException("Elige el método de entrega");
        // the customer chose (and paid for) picking it up or having it brought: the store only picks who takes it there
        if ((newMethod == DeliveryMethod.PICKUP) != (method == DeliveryMethod.PICKUP))
            throw new IllegalArgumentException(method == DeliveryMethod.PICKUP ? "El cliente eligió recoger en la tienda; no se puede pasar a envío" : "El cliente pidió que se lo enviaran; no se puede pasar a recoger en la tienda");
        return new Shipment(id, orderId, newMethod, status, carrier, trackingCode, courierUserId, courierName, recipientName, failureReason, packedAt, shippedAt, deliveredAt).withDetails(d);
    }
    /** The order was cancelled: whatever was not delivered stops. */
    public Shipment cancel() { return new Shipment(id, orderId, method, FulfillmentStatus.CANCELLED, carrier, trackingCode, courierUserId, courierName, recipientName, failureReason, packedAt, shippedAt, deliveredAt); }

    private Shipment withDetails(Details d) {
        return new Shipment(id, orderId, method, status, pick(d.carrier(), carrier), pick(d.trackingCode(), trackingCode),
            d.courierUserId() != null ? d.courierUserId() : (!blank(d.courierName()) ? null : courierUserId), pick(d.courierName(), d.courierUserId() != null ? null : courierName),
            recipientName, failureReason, packedAt, shippedAt, deliveredAt);
    }
    private static boolean blank(String s) { return s == null || s.isBlank(); }
    private static String trimOrNull(String s) { return blank(s) ? null : s.trim(); }
    private static String pick(String given, String current) { return blank(given) ? current : given.trim(); }
}

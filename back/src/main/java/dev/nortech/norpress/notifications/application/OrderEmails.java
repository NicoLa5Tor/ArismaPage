package dev.nortech.norpress.notifications.application;
import dev.nortech.norpress.fulfillment.application.ShipmentMoved;
import dev.nortech.norpress.fulfillment.domain.FulfillmentStatus;
import dev.nortech.norpress.sales.application.StorefrontOrders;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.inject.Inject;

/**
 * Emails that follow an order's delivery: on its way (with the guide), ready to collect at the shop, delivered. The
 * buyer's address comes from the order itself.
 */
@ApplicationScoped
public class OrderEmails {
    @Inject StorefrontOrders orders;
    @Inject NotificationService notifications;
    @Inject dev.nortech.norpress.fulfillment.application.FulfillmentService fulfillment;

    void onShipment(@Observes ShipmentMoved event) {
        if (!event.tell()) return;
        var order = orders.payable(event.orderId()).filter(o -> !o.email().isBlank()).orElse(null);
        if (order == null) return;
        switch (event.to()) {
            case SHIPPED -> notifications.orderShipped(order.email(), order.buyerName(), order.number(), event.carrier(), event.trackingCode(), fulfillment.trackingLink(event.carrier(), event.trackingCode()));
            case PACKED -> { if (event.pickup()) notifications.readyForPickup(order.email(), order.buyerName(), order.number(), link(order.number())); }
            case DELIVERED -> notifications.orderDelivered(order.email(), order.buyerName(), order.number(), link(order.number()));
            default -> { }
        }
    }
    @org.eclipse.microprofile.config.inject.ConfigProperty(name = "norpress.public-url", defaultValue = "http://localhost:8000") String site;
    private String link(String number) { return site.replaceAll("/+$", "") + "/cuenta/pedidos/" + java.net.URLEncoder.encode(number, java.nio.charset.StandardCharsets.UTF_8); }
}

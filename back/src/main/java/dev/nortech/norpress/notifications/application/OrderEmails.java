package dev.nortech.norpress.notifications.application;
import dev.nortech.norpress.fulfillment.application.ShipmentMoved;
import dev.nortech.norpress.fulfillment.domain.FulfillmentStatus;
import dev.nortech.norpress.sales.application.StorefrontOrders;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.inject.Inject;

/** Emails that follow an order's delivery. The buyer's address comes from the order itself. */
@ApplicationScoped
public class OrderEmails {
    @Inject StorefrontOrders orders;
    @Inject NotificationService notifications;
    @Inject dev.nortech.norpress.fulfillment.application.FulfillmentService fulfillment;

    void onShipment(@Observes ShipmentMoved event) {
        if (event.to() != FulfillmentStatus.SHIPPED) return;
        orders.payable(event.orderId()).filter(o -> !o.email().isBlank())
            .ifPresent(o -> notifications.orderShipped(o.email(), o.buyerName(), o.number(), event.carrier(), event.trackingCode(), fulfillment.trackingLink(event.carrier(), event.trackingCode())));
    }
}

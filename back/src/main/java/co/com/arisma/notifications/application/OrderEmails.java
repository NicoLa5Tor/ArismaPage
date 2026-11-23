package co.com.arisma.notifications.application;
import co.com.arisma.fulfillment.application.ShipmentMoved;
import co.com.arisma.fulfillment.domain.Carrier;
import co.com.arisma.fulfillment.domain.FulfillmentStatus;
import co.com.arisma.sales.application.StorefrontOrders;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.inject.Inject;

/** Emails that follow an order's delivery. The buyer's address comes from the order itself. */
@ApplicationScoped
public class OrderEmails {
    @Inject StorefrontOrders orders;
    @Inject NotificationService notifications;

    void onShipment(@Observes ShipmentMoved event) {
        if (event.to() != FulfillmentStatus.SHIPPED) return;
        orders.payable(event.orderId()).filter(o -> !o.email().isBlank())
            .ifPresent(o -> notifications.orderShipped(o.email(), o.buyerName(), o.number(), event.carrier(), event.trackingCode(), Carrier.match(event.carrier()).map(c -> c.trackingPage).orElse(null)));
    }
}

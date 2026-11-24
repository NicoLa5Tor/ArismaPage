package dev.nortech.norpress.fulfillment.adapter;
import dev.nortech.norpress.fulfillment.application.FulfillmentPorts.OrderLifecycle;
import dev.nortech.norpress.sales.application.OrderService;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.UUID;

/** Bridges the deliveries module to the sales module's application API. */
@ApplicationScoped
public class SalesOrderLifecycle implements OrderLifecycle {
    @Inject OrderService orders;
    public void completeOnDelivery(UUID orderId, UUID actor) { orders.completeOnDelivery(orderId, actor); }
}

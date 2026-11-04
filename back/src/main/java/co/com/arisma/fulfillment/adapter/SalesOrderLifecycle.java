package co.com.arisma.fulfillment.adapter;
import co.com.arisma.fulfillment.application.FulfillmentPorts.OrderLifecycle;
import co.com.arisma.sales.application.OrderService;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.UUID;

/** Bridges the deliveries module to the sales module's application API. */
@ApplicationScoped
public class SalesOrderLifecycle implements OrderLifecycle {
    @Inject OrderService orders;
    public void completeOnDelivery(UUID orderId, UUID actor) { orders.completeOnDelivery(orderId, actor); }
}

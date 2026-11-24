package dev.nortech.norpress.fulfillment.adapter;
import dev.nortech.norpress.fulfillment.application.ShipmentFeed;
import dev.nortech.norpress.fulfillment.application.ShipmentMoved;
import dev.nortech.norpress.sales.application.OrderStatusChanged;
import io.smallrye.mutiny.Multi;
import io.smallrye.mutiny.operators.multi.processors.BroadcastProcessor;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.enterprise.event.TransactionPhase;

/**
 * The feed of changes, in memory, reactive (Mutiny): one processor broadcasts every change to all the open screens.
 * Changes are published only after their transaction commits, so a screen never reloads before the data is there.
 * With several servers each one only sees its own changes: the screens still refresh on their next load.
 */
@ApplicationScoped
public class BroadcastFeed implements ShipmentFeed {
    private final BroadcastProcessor<Change> processor = BroadcastProcessor.create();

    public void publish(Change change) { processor.onNext(change); }
    public Multi<Change> changes() { return processor.onOverflow().drop(); }

    void onShipment(@Observes(during = TransactionPhase.AFTER_SUCCESS) ShipmentMoved event) { publish(new Change(event.orderId(), "shipment")); }
    void onOrder(@Observes(during = TransactionPhase.AFTER_SUCCESS) OrderStatusChanged event) { publish(new Change(event.orderId(), "order")); }
    void onAfterSale(@Observes(during = TransactionPhase.AFTER_SUCCESS) dev.nortech.norpress.sales.application.AfterSaleChanged event) { publish(new Change(event.orderId(), "order")); }
}

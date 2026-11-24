package dev.nortech.norpress.fulfillment.adapter;
import dev.nortech.norpress.fulfillment.application.TrackingService;
import io.quarkus.scheduler.Scheduled;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

/** Every half hour: new guides start being followed; each shipment on its way is looked at again every few hours. */
@ApplicationScoped
public class TrackingJob {
    @Inject TrackingService tracking;

    @Scheduled(every = "${norpress.tracking.every:30m}", delayed = "2m", concurrentExecution = Scheduled.ConcurrentExecution.SKIP)
    void run() { tracking.sync(); }
}

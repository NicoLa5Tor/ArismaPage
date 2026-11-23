package co.com.arisma.fulfillment.adapter;
import co.com.arisma.fulfillment.application.TrackingService;
import io.quarkus.scheduler.Scheduled;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

/** Every half hour: new guides start being followed; each shipment on its way is looked at again every few hours. */
@ApplicationScoped
public class TrackingJob {
    @Inject TrackingService tracking;

    @Scheduled(every = "${arisma.tracking.every:30m}", delayed = "2m", concurrentExecution = Scheduled.ConcurrentExecution.SKIP)
    void run() { tracking.sync(); }
}

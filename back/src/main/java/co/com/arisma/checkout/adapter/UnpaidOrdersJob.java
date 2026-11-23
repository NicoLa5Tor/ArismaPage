package co.com.arisma.checkout.adapter;
import co.com.arisma.payments.application.PaymentService;
import co.com.arisma.sales.application.OrderPlacement;
import io.quarkus.runtime.ShutdownEvent;
import io.quarkus.runtime.StartupEvent;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.inject.Inject;
import java.time.Instant;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * Every ten minutes, cancels store orders whose time to pay ran out, so the units they held go back on sale. Right
 * before, it asks the gateway about those orders only: one paid while nobody was looking is marked paid, never cancelled.
 */
@ApplicationScoped
public class UnpaidOrdersJob {
    @Inject OrderPlacement placement;
    @Inject PaymentService payments;
    private ScheduledExecutorService timer;

    void start(@Observes StartupEvent event) {
        timer = Executors.newSingleThreadScheduledExecutor(r -> { var t = new Thread(r, "unpaid-orders"); t.setDaemon(true); return t; });
        timer.scheduleWithFixedDelay(this::round, 1, 10, TimeUnit.MINUTES);
    }
    void round() {
        Instant now = Instant.now();
        try { payments.reconcileExpired(now); } catch (RuntimeException ignored) { /* the gateway did not answer: the order waits for the next round */ }
        try { placement.cancelExpired(now); } catch (RuntimeException ignored) { /* next round tries again */ }
    }
    void stop(@Observes ShutdownEvent event) { if (timer != null) timer.shutdownNow(); }
}

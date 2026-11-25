package dev.nortech.norpress.checkout.adapter;
import dev.nortech.norpress.payments.application.PaymentService;
import dev.nortech.norpress.sales.application.OrderPlacement;
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
 * Every five minutes, cancels store orders whose time to pay ran out, so the units they held go back on sale. Right
 * before, it asks the gateway about those orders only: one paid while nobody was looking is marked paid, never cancelled,
 * and one whose payment the gateway is still processing (PSE, Nequi) waits for its answer.
 */
@ApplicationScoped
public class UnpaidOrdersJob {
    @Inject OrderPlacement placement;
    @Inject PaymentService payments;
    @Inject dev.nortech.norpress.sales.application.AfterSaleService afterSale;
    private ScheduledExecutorService timer;

    void start(@Observes StartupEvent event) {
        timer = Executors.newSingleThreadScheduledExecutor(r -> { var t = new Thread(r, "unpaid-orders"); t.setDaemon(true); return t; });
        timer.scheduleWithFixedDelay(this::round, 1, 5, TimeUnit.MINUTES);
    }
    void round() {
        Instant now = Instant.now();
        try { payments.reconcileExpired(now); } catch (RuntimeException ignored) { /* the gateway did not answer: the order waits for the next round */ }
        try { placement.cancelExpired(now, payments.waitingForGateway(now)); } catch (RuntimeException ignored) { /* next round tries again */ }
        // refunds never sent (PayU's first 10 minutes, a restart) and those PayU is still reviewing
        try { afterSale.processPending(); } catch (RuntimeException ignored) { /* next round tries again */ }
    }
    void stop(@Observes ShutdownEvent event) { if (timer != null) timer.shutdownNow(); }
}

package dev.nortech.norpress.notifications.adapter;
import dev.nortech.norpress.notifications.application.NotificationService;
import io.quarkus.runtime.ShutdownEvent;
import io.quarkus.runtime.StartupEvent;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.inject.Inject;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/** Every thirty seconds, sends the emails that are due. */
@ApplicationScoped
public class MailJob {
    @Inject NotificationService notifications;
    private ScheduledExecutorService timer;

    void start(@Observes StartupEvent event) {
        timer = Executors.newSingleThreadScheduledExecutor(r -> { var t = new Thread(r, "mail-outbox"); t.setDaemon(true); return t; });
        timer.scheduleWithFixedDelay(() -> { try { notifications.deliverDue(); } catch (RuntimeException ignored) { /* next round tries again */ } }, 10, 30, TimeUnit.SECONDS);
    }
    void stop(@Observes ShutdownEvent event) { if (timer != null) timer.shutdownNow(); }
}

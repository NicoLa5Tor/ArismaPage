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

/** Every thirty seconds, sends the emails that are due; every six hours, empties the content of the old ones. */
@ApplicationScoped
public class MailJob {
    @Inject NotificationService notifications;
    private ScheduledExecutorService timer;

    void start(@Observes StartupEvent event) {
        timer = Executors.newSingleThreadScheduledExecutor(r -> { var t = new Thread(r, "mail-outbox"); t.setDaemon(true); return t; });
        timer.scheduleWithFixedDelay(() -> { try { notifications.deliverDue(); } catch (RuntimeException ignored) { /* next round tries again */ } }, 10, 30, TimeUnit.SECONDS);
        timer.scheduleWithFixedDelay(() -> { try { notifications.forgetOld(); } catch (RuntimeException ignored) { /* next round tries again */ } }, 5, 360, TimeUnit.MINUTES);
    }
    void stop(@Observes ShutdownEvent event) { if (timer != null) timer.shutdownNow(); }
}

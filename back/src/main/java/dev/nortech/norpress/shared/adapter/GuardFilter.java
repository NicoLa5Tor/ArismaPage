package dev.nortech.norpress.shared.adapter;
import dev.nortech.norpress.shared.application.HumanCheck;
import dev.nortech.norpress.shared.domain.RateWindow;
import io.vertx.core.http.HttpServerRequest;
import jakarta.annotation.Priority;
import jakarta.inject.Inject;
import jakarta.ws.rs.Priorities;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerRequestFilter;
import jakarta.ws.rs.container.ResourceInfo;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.Provider;
import java.net.InetAddress;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Applies {@link Guarded}: counts calls per client address and bucket in memory (one instance per store in phase 1) and
 * asks Turnstile when the endpoint wants a person. The limit is checked first, so a flood never reaches Cloudflare.
 *
 * The client address is the connection's, unless the connection comes from this machine or the private network (the
 * store's own Next.js proxy): then it is the first X-Forwarded-For entry, which that proxy sets.
 */
@Provider @Priority(Priorities.AUTHENTICATION - 100)
public class GuardFilter implements ContainerRequestFilter {
    public static final String TOKEN_HEADER = "X-Turnstile-Token";
    private static final int MAX_KEYS = 100_000;
    private static final Duration LONGEST = Duration.ofHours(2);
    private static final Map<String, RateWindow> WINDOWS = new ConcurrentHashMap<>();
    private static final AtomicLong LAST_SWEEP = new AtomicLong();
    @Inject HumanCheck human;
    @Context ResourceInfo resource;
    @Context HttpServerRequest connection;

    public void filter(ContainerRequestContext request) {
        var method = resource == null ? null : resource.getResourceMethod();
        var guard = method == null ? null : method.getAnnotation(Guarded.class);
        if (guard == null) return;
        String client = clientAddress(request.getHeaderString("X-Forwarded-For"));
        Instant now = Instant.now();
        Duration window = Duration.ofSeconds(guard.windowSeconds());
        sweep(now);
        var state = WINDOWS.compute(guard.bucket() + "|" + client, (key, current) -> (current == null ? RateWindow.EMPTY : current).hit(now, window));
        if (state.exceeds(guard.limit())) {
            long wait = state.retryAfter(now, window);
            request.abortWith(Response.status(429).type(MediaType.APPLICATION_JSON).header("Retry-After", wait)
                .entity(Map.of("error", "Demasiados intentos desde tu conexión. Espera " + humanWait(wait) + " y vuelve a intentarlo.")).build());
            return;
        }
        if (guard.human() && human.enabled() && !human.verify(request.getHeaderString(TOKEN_HEADER), client))
            request.abortWith(Response.status(403).type(MediaType.APPLICATION_JSON)
                .entity(Map.of("error", "No pudimos confirmar que eres una persona. Completa la verificación y vuelve a intentarlo.", "code", "human_check")).build());
    }

    private String clientAddress(String forwarded) {
        String direct = connection == null || connection.remoteAddress() == null ? "" : connection.remoteAddress().hostAddress();
        if (forwarded != null && !forwarded.isBlank() && trusted(direct)) {
            String first = forwarded.split(",")[0].trim();
            if (!first.isEmpty() && first.length() <= 64) return first;
        }
        return direct.isEmpty() ? "desconocida" : direct;
    }
    private static boolean trusted(String address) {
        if (address == null || address.isEmpty()) return false;
        try {
            var ip = InetAddress.getByName(address);
            return ip.isLoopbackAddress() || ip.isSiteLocalAddress();
        } catch (Exception e) { return false; }
    }
    /** Drops finished windows once a minute, and everything if a flood of addresses filled the table, so memory stays bounded. */
    private static void sweep(Instant now) {
        long last = LAST_SWEEP.get();
        if (now.toEpochMilli() - last < 60_000 && WINDOWS.size() < MAX_KEYS) return;
        if (!LAST_SWEEP.compareAndSet(last, now.toEpochMilli())) return;
        if (WINDOWS.size() >= MAX_KEYS) { WINDOWS.clear(); return; }
        WINDOWS.entrySet().removeIf(e -> e.getValue().expired(now, LONGEST));
    }
    static String humanWait(long seconds) {
        if (seconds < 60) return seconds + " segundos";
        long minutes = (seconds + 59) / 60;
        return minutes == 1 ? "un minuto" : minutes + " minutos";
    }
}

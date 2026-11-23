package co.com.arisma.fulfillment.application;
import co.com.arisma.fulfillment.application.TrackingPorts.*;
import co.com.arisma.fulfillment.domain.*;
import co.com.arisma.settings.application.StoreSettingsService;
import co.com.arisma.settings.domain.TrackingSettings;
import co.com.arisma.shared.domain.NotFound;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.*;
import java.util.*;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Follows carrier shipments by asking the tracking provider, so the team and the shopper see each step without
 * opening the carrier's page. The administrator turns it on; the plan caps how many shipments start being followed
 * each calendar month (Bogotá time). When the carrier confirms the delivery, the shipment and the order close by
 * themselves. Network calls run outside transactions: every write here is a short statement of its own.
 */
@ApplicationScoped
public class TrackingService {
    private static final Logger LOG = Logger.getLogger(TrackingService.class.getName());
    static final ZoneId BOGOTA = ZoneId.of("America/Bogota");
    static final int BATCH = 40;
    /** How often a shipment on its way is looked at again. */
    static final Duration EVERY = Duration.ofHours(4);

    public record Status(boolean enabled, boolean ready, TrackingPlan plan, TrackingQuota quota, String month) {}

    @Inject TrackingProvider provider;
    @Inject TrackingAccount account;
    @Inject TrackingRepository tracking;
    @Inject StoreSettingsService settings;
    @Inject FulfillmentService fulfillment;
    Clock clock = Clock.systemUTC();

    public Status status() {
        return new Status(settings.tracking().enabled(), provider.configured(), account.plan(), quota(), YearMonth.now(clock.withZone(BOGOTA)).toString());
    }
    public Status enable(boolean on, UUID actor) {
        settings.save(new TrackingSettings(on), actor);
        return status();
    }
    TrackingQuota quota() {
        var start = YearMonth.now(clock.withZone(BOGOTA)).atDay(1).atStartOfDay(BOGOTA).toInstant();
        return new TrackingQuota(account.plan(), tracking.registeredSince(start));
    }

    /** The periodic job: start following new shipments within the month's quota, then look again at those on their way. */
    public void sync() {
        if (!settings.tracking().enabled() || !provider.configured()) return;
        tracking.finishClosed();
        var quota = quota();
        if (!quota.exhausted()) start(tracking.pending(Math.min(BATCH, quota.remaining())));
        List<Followed> due;
        int rounds = 0;
        while (rounds++ < 25 && !(due = tracking.due(EVERY, BATCH)).isEmpty()) if (!look(due)) break;
    }

    /** "Update now" from the order: starts following it if needed (and the quota allows), then asks the carrier. */
    public void refresh(UUID orderId) {
        if (!settings.tracking().enabled()) throw new IllegalArgumentException("El seguimiento automático está apagado. Actívalo en Ajustes, pestaña Envíos");
        if (!provider.configured()) throw new IllegalArgumentException("El servidor aún no tiene la llave del servicio de seguimiento");
        var pending = tracking.pendingFor(orderId);
        if (pending.isPresent()) {
            if (quota().exhausted()) throw new IllegalArgumentException("Ya se usaron los " + account.plan().monthlyShipments + " envíos con seguimiento de este mes. Amplía el plan para seguir más");
            start(List.of(pending.get()));
        }
        var followed = tracking.followed(orderId).orElseThrow(() -> new NotFound("Este envío no tiene una guía en seguimiento"));
        if (!look(List.of(followed))) throw new IllegalStateException("El servicio de seguimiento no respondió. Inténtalo en unos minutos");
    }

    void start(List<Pending> pending) {
        if (pending.isEmpty()) return;
        var byNumber = new LinkedHashMap<String, Pending>();
        var keys = new HashMap<String, Integer>();
        var parcels = new ArrayList<Parcel>();
        for (var p : pending) {
            Integer key = Carrier.match(p.carrier()).map(c -> c.trackingKey).orElse(null);
            byNumber.put(p.number(), p); keys.put(p.number(), key); parcels.add(new Parcel(p.number(), key));
        }
        List<Registration> results;
        try { results = provider.register(parcels); } catch (RuntimeException e) { LOG.log(Level.WARNING, "No se pudieron registrar guías en el servicio de seguimiento", e); return; }
        for (var r : results) {
            var p = byNumber.get(r.number());
            if (p == null || r.quotaExhausted()) continue;
            if (r.accepted()) tracking.registered(p.shipmentId(), p.number(), keys.get(r.number()));
            else tracking.rejected(p.shipmentId(), p.number(), r.error());
        }
    }

    /** False when the provider could not be reached: nothing was marked as looked at. */
    boolean look(List<Followed> followed) {
        var byNumber = new LinkedHashMap<String, Followed>();
        followed.forEach(f -> byNumber.put(f.number(), f));
        List<Report> reports;
        try { reports = provider.fetch(followed.stream().map(f -> new Parcel(f.number(), f.carrierKey())).toList()); }
        catch (RuntimeException e) { LOG.log(Level.WARNING, "No se pudo consultar el servicio de seguimiento", e); return false; }
        var seen = new HashSet<String>();
        for (var r : reports) {
            var f = byNumber.get(r.number());
            if (f == null) continue;
            seen.add(r.number());
            tracking.report(f.shipmentId(), r.stage(), r.events());
            if (r.stage() == TrackingStage.DELIVERED) deliver(f);
        }
        // numbers the carrier has not published yet keep their stage and wait for the next round
        for (var f : followed) if (!seen.contains(f.number())) tracking.report(f.shipmentId(), null, List.of());
        return true;
    }

    private void deliver(Followed f) {
        String carrier = Carrier.match(f.carrier()).map(c -> c.label).orElse(f.carrier());
        try { fulfillment.moveAlone(f.orderId(), FulfillmentStatus.DELIVERED, "Entrega confirmada por " + carrier, null); }
        catch (IllegalArgumentException | NotFound e) { LOG.info("El pedido " + f.orderId() + " figura entregado por la transportadora, pero no se pudo cerrar: " + e.getMessage()); }
    }
}

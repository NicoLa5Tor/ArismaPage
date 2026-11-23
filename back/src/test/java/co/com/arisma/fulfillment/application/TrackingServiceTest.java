package co.com.arisma.fulfillment.application;
import static org.junit.jupiter.api.Assertions.*;
import co.com.arisma.fulfillment.application.TrackingPorts.*;
import co.com.arisma.fulfillment.domain.*;
import co.com.arisma.settings.application.StoreSettingsService;
import co.com.arisma.settings.domain.TrackingSettings;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** Automatic tracking with in-memory adapters: the switch, the monthly quota and closing on delivery. */
class TrackingServiceTest {
    static class Settings extends StoreSettingsService {
        boolean enabled = true;
        @Override public TrackingSettings tracking() { return new TrackingSettings(enabled); }
        @Override public TrackingSettings save(TrackingSettings value, UUID actor) { enabled = value.enabled(); return value; }
    }
    static class Provider implements TrackingProvider {
        boolean configured = true, down = false; final Set<String> invalid = new HashSet<>(); final List<String> registered = new ArrayList<>();
        final Map<String, Report> reports = new HashMap<>();
        public boolean configured() { return configured; }
        public List<Registration> register(List<Parcel> parcels) {
            if (down) throw new IllegalStateException("caído");
            return parcels.stream().map(p -> { if (invalid.contains(p.number())) return new Registration(p.number(), false, "formato", false); registered.add(p.number() + "@" + p.carrierKey()); return new Registration(p.number(), true, null, false); }).toList();
        }
        public List<Report> fetch(List<Parcel> parcels) { if (down) throw new IllegalStateException("caído"); return parcels.stream().map(p -> reports.get(p.number())).filter(Objects::nonNull).toList(); }
    }
    static class Repo implements TrackingRepository {
        final List<Pending> waiting = new ArrayList<>(); final Map<UUID, Followed> following = new LinkedHashMap<>(); final Map<UUID, String> rejected = new HashMap<>();
        final Map<UUID, TrackingStage> stages = new HashMap<>(); final Map<UUID, Integer> looks = new HashMap<>(); int countedBefore = 0, counted = 0;
        public List<Pending> pending(int limit) { return waiting.stream().filter(p -> !following.containsKey(p.shipmentId()) && !rejected.containsKey(p.shipmentId())).limit(limit).toList(); }
        public Optional<Pending> pendingFor(UUID orderId) { return pending(99).stream().filter(p -> p.orderId().equals(orderId)).findFirst(); }
        public int registeredSince(Instant from) { return countedBefore + counted; }
        public void registered(UUID id, String number, Integer key) { var p = waiting.stream().filter(x -> x.shipmentId().equals(id)).findFirst().orElseThrow(); following.put(id, new Followed(id, p.orderId(), p.carrier(), number, key)); counted++; }
        public void rejected(UUID id, String number, String error) { rejected.put(id, error); }
        public List<Followed> due(Duration every, int limit) { return following.values().stream().filter(f -> !looks.containsKey(f.shipmentId()) && stages.get(f.shipmentId()) != TrackingStage.DELIVERED).limit(limit).toList(); }
        public Optional<Followed> followed(UUID orderId) { return following.values().stream().filter(f -> f.orderId().equals(orderId)).findFirst(); }
        public void report(UUID id, TrackingStage stage, List<TrackingEvent> events) { if (stage != null) stages.put(id, stage); looks.merge(id, 1, Integer::sum); }
        public int finishClosed() { return 0; }
    }
    static class Delivered extends FulfillmentService { final List<UUID> orders = new ArrayList<>(); @Override public void moveAlone(UUID orderId, FulfillmentStatus next, String note, UUID actor) { orders.add(orderId); } }

    Settings settings; Provider provider; Repo repo; Delivered fulfillment; TrackingService service; TrackingPlan plan = TrackingPlan.FREE;
    @BeforeEach void setUp() {
        settings = new Settings(); provider = new Provider(); repo = new Repo(); fulfillment = new Delivered();
        service = new TrackingService(); service.settings = settings; service.provider = provider; service.tracking = repo; service.fulfillment = fulfillment; service.account = () -> plan;
        service.clock = Clock.fixed(Instant.parse("2026-11-13T15:00:00Z"), ZoneOffset.UTC);
    }
    Pending ship(String carrier, String number) { var p = new Pending(UUID.randomUUID(), UUID.randomUUID(), carrier, number); repo.waiting.add(p); return p; }

    @Test void offDoesNothing() {
        settings.enabled = false; ship("Interrapidísimo", "240041234567");
        service.sync();
        assertTrue(provider.registered.isEmpty());
    }
    @Test void withoutKeyDoesNothing() {
        provider.configured = false; ship("Inter", "1");
        service.sync();
        assertTrue(provider.registered.isEmpty());
        assertFalse(service.status().ready());
    }
    @Test void registersWithTheCarrierCode() {
        ship("INTER RAPIDISIMO", "240041234567"); ship("Transportes Juan", "999");
        service.sync();
        assertEquals(List.of("240041234567@100491", "999@null"), provider.registered);
    }
    @Test void freePlanStopsAtTenAMonth() {
        repo.countedBefore = 8;
        for (int i = 0; i < 5; i++) ship("Coordinadora", "1000" + i);
        service.sync();
        assertEquals(2, provider.registered.size());
        assertEquals(0, service.status().quota().remaining());
        var left = repo.pending(99).getFirst();
        var e = assertThrows(IllegalArgumentException.class, () -> service.refresh(left.orderId()));
        assertTrue(e.getMessage().contains("10"));
    }
    @Test void plusPlanAllowsFifty() {
        plan = TrackingPlan.PLUS; repo.countedBefore = 10;
        for (int i = 0; i < 5; i++) ship("TCC", "2000" + i);
        service.sync();
        assertEquals(5, provider.registered.size());
        assertEquals(35, service.status().quota().remaining());
    }
    @Test void rejectedNumbersAreNotRetried() {
        var p = ship("Envía", "abc"); provider.invalid.add("abc");
        service.sync(); service.sync();
        assertEquals("formato", repo.rejected.get(p.shipmentId()));
        assertEquals(0, repo.counted);
    }
    @Test void deliveryClosesTheOrder() {
        var p = ship("Inter", "240041234567");
        provider.reports.put("240041234567", new Report("240041234567", TrackingStage.DELIVERED, List.of(new TrackingEvent(Instant.parse("2026-11-12T20:00:00Z"), "Entregado", "Bogotá"))));
        service.sync();
        assertEquals(List.of(p.orderId()), fulfillment.orders);
        assertEquals(TrackingStage.DELIVERED, repo.stages.get(p.shipmentId()));
    }
    @Test void unknownNumberKeepsWaiting() {
        var p = ship("Inter", "240041234567");
        service.sync();
        assertNull(repo.stages.get(p.shipmentId()));
        assertEquals(1, repo.looks.get(p.shipmentId()));
        assertTrue(fulfillment.orders.isEmpty());
    }
    @Test void providerDownMarksNothing() {
        var p = ship("Inter", "240041234567");
        service.sync();
        repo.looks.clear(); provider.down = true;
        service.sync();
        assertFalse(repo.looks.containsKey(p.shipmentId()));
        assertThrows(IllegalStateException.class, () -> service.refresh(p.orderId()));
    }
    @Test void refreshNeedsTheSwitchOn() {
        settings.enabled = false;
        assertThrows(IllegalArgumentException.class, () -> service.refresh(UUID.randomUUID()));
    }
    @Test void carrierNamesMatchLoosely() {
        assertEquals(Optional.of(Carrier.INTER), Carrier.match(" Interrapidísimo "));
        assertEquals(Optional.of(Carrier.POSTAL), Carrier.match("4-72"));
        assertEquals(Optional.of(Carrier.ENVIA), Carrier.match("ENVIA"));
        assertEquals(Optional.empty(), Carrier.match("Mensajería Pepe"));
    }
}

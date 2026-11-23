package co.com.arisma.fulfillment.adapter;
import co.com.arisma.fulfillment.application.TrackingPorts.*;
import co.com.arisma.fulfillment.domain.TrackingEvent;
import co.com.arisma.fulfillment.domain.TrackingStage;
import co.com.arisma.shared.adapter.Jdbc;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import javax.sql.DataSource;
import java.time.Duration;
import java.time.Instant;
import java.util.*;

@ApplicationScoped
public class PostgresTracking implements TrackingRepository {
    /** Carrier shipments on their way whose current number is not followed yet. Older than 30 days are left alone. */
    private static final String PENDING = "SELECT s.id AS shipment_id,s.order_id,s.carrier,s.tracking_code FROM shipment s LEFT JOIN shipment_tracking t ON t.shipment_id=s.id"
        + " WHERE s.method='carrier' AND s.status='shipped' AND COALESCE(s.tracking_code,'')<>'' AND s.shipped_at>now()-interval '30 days' AND (t.shipment_id IS NULL OR t.number<>s.tracking_code)";
    private static final String FOLLOWED = "SELECT t.shipment_id,s.order_id,s.carrier,t.number,t.carrier_key FROM shipment_tracking t JOIN shipment s ON s.id=t.shipment_id"
        + " WHERE t.state='following' AND s.status IN ('shipped','failed') AND t.number=s.tracking_code";
    @Inject DataSource db;

    public List<Pending> pending(int limit) {
        if (limit <= 0) return List.of();
        return Jdbc.with(db, c -> Jdbc.list(c, PENDING + " ORDER BY s.shipped_at LIMIT ?", limit).stream().map(PostgresTracking::pending).toList());
    }
    public Optional<Pending> pendingFor(UUID orderId) { return Jdbc.with(db, c -> Jdbc.one(c, PENDING + " AND s.order_id=?", orderId).map(PostgresTracking::pending)); }
    private static Pending pending(Map<String, Object> r) { return new Pending((UUID) r.get("shipmentId"), (UUID) r.get("orderId"), (String) r.get("carrier"), ((String) r.get("trackingCode")).trim()); }

    public int registeredSince(Instant from) { return Jdbc.with(db, c -> Jdbc.count(c, "SELECT count(*) FROM tracking_registration WHERE registered_at>=?", from)).intValue(); }

    public void registered(UUID shipmentId, String number, Integer carrierKey) {
        Jdbc.with(db, c -> {
            Jdbc.update(c, "DELETE FROM shipment_tracking_event WHERE shipment_id=?", shipmentId);
            Jdbc.update(c, "INSERT INTO shipment_tracking(shipment_id,number,carrier_key,state,stage,error,registered_at,checked_at,changed_at) VALUES(?,?,?,'following','waiting',NULL,now(),NULL,now())"
                + " ON CONFLICT (shipment_id) DO UPDATE SET number=excluded.number,carrier_key=excluded.carrier_key,state='following',stage='waiting',error=NULL,registered_at=now(),checked_at=NULL,changed_at=now()", shipmentId, number, carrierKey);
            return Jdbc.update(c, "INSERT INTO tracking_registration(id,shipment_id,number) VALUES(?,?,?)", UUID.randomUUID(), shipmentId, number);
        });
    }
    public void rejected(UUID shipmentId, String number, String error) {
        String reason = error == null || error.isBlank() ? "El servicio de seguimiento no reconoce esta guía" : error.length() > 300 ? error.substring(0, 300) : error;
        Jdbc.with(db, c -> Jdbc.update(c, "INSERT INTO shipment_tracking(shipment_id,number,state,error,checked_at) VALUES(?,?,'rejected',?,now())"
            + " ON CONFLICT (shipment_id) DO UPDATE SET number=excluded.number,state='rejected',stage=NULL,error=excluded.error,checked_at=now()", shipmentId, number, reason));
    }

    public List<Followed> due(Duration every, int limit) {
        return Jdbc.with(db, c -> Jdbc.list(c, FOLLOWED + " AND (t.checked_at IS NULL OR t.checked_at<now()-make_interval(secs=>?)) ORDER BY t.checked_at NULLS FIRST LIMIT ?", (double) every.toSeconds(), limit)
            .stream().map(PostgresTracking::followed).toList());
    }
    public Optional<Followed> followed(UUID orderId) { return Jdbc.with(db, c -> Jdbc.one(c, FOLLOWED + " AND s.order_id=?", orderId).map(PostgresTracking::followed)); }
    private static Followed followed(Map<String, Object> r) {
        return new Followed((UUID) r.get("shipmentId"), (UUID) r.get("orderId"), (String) r.get("carrier"), (String) r.get("number"), r.get("carrierKey") == null ? null : ((Number) r.get("carrierKey")).intValue());
    }

    public void report(UUID shipmentId, TrackingStage stage, List<TrackingEvent> events) {
        String s = stage == null ? null : stage.db();
        Jdbc.with(db, c -> {
            Jdbc.update(c, "UPDATE shipment_tracking SET checked_at=now(), changed_at=CASE WHEN ?::text IS NOT NULL AND stage IS DISTINCT FROM ?::text THEN now() ELSE changed_at END,"
                + " stage=COALESCE(?::text,stage), state=CASE WHEN ?::text='delivered' THEN 'finished' ELSE state END WHERE shipment_id=?", s, s, s, s, shipmentId);
            for (var e : events) Jdbc.update(c, "INSERT INTO shipment_tracking_event(id,shipment_id,occurred_at,description,location) VALUES(?,?,?,?,?) ON CONFLICT DO NOTHING",
                UUID.randomUUID(), shipmentId, e.at(), e.description(), e.location());
            return null;
        });
    }
    public int finishClosed() {
        return Jdbc.with(db, c -> Jdbc.update(c, "UPDATE shipment_tracking t SET state='finished' FROM shipment s WHERE s.id=t.shipment_id AND t.state='following' AND s.status NOT IN ('shipped','failed')"));
    }

    /** What the panel and the shop show: the stage, why it is not followed, and the carrier's movements, newest first. */
    static Map<String, Object> view(java.sql.Connection c, UUID shipmentId) throws java.sql.SQLException {
        var row = Jdbc.one(c, "SELECT state,stage,error,checked_at,changed_at FROM shipment_tracking WHERE shipment_id=?", shipmentId);
        if (row.isEmpty()) return null;
        var out = new LinkedHashMap<String, Object>(row.get());
        var stage = out.get("stage") == null ? null : TrackingStage.fromDb((String) out.get("stage"));
        out.put("stageLabel", stage == null ? null : stage.label);
        out.put("stageText", stage == null ? null : stage.text);
        out.put("events", Jdbc.list(c, "SELECT occurred_at AS at,description,location FROM shipment_tracking_event WHERE shipment_id=? ORDER BY occurred_at DESC LIMIT 60", shipmentId));
        return out;
    }
}

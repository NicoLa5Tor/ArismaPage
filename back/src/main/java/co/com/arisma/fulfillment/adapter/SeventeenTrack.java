package co.com.arisma.fulfillment.adapter;
import co.com.arisma.fulfillment.application.TrackingPorts.*;
import co.com.arisma.fulfillment.domain.TrackingEvent;
import co.com.arisma.fulfillment.domain.TrackingPlan;
import co.com.arisma.fulfillment.domain.TrackingStage;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import jakarta.enterprise.context.ApplicationScoped;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.*;

/**
 * 17TRACK tracking API v2.2. Registering a number spends one unit of the 17TRACK account; asking about a registered
 * number again does not. The key (ARISMA_TRACKING_KEY) and the store's plan (ARISMA_TRACKING_PLAN: free or plus) live
 * in the server's environment, never in the database or the panel.
 */
@ApplicationScoped
public class SeventeenTrack implements TrackingProvider, TrackingAccount {
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final HttpClient HTTP = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(8)).build();
    static final int QUOTA_EXHAUSTED = -18019908, ALREADY_REGISTERED = -18019901;
    @ConfigProperty(name = "arisma.tracking.key") Optional<String> key;
    @ConfigProperty(name = "arisma.tracking.plan", defaultValue = "free") String plan;
    @ConfigProperty(name = "arisma.tracking.url", defaultValue = "https://api.17track.net/track/v2.2") String base;

    public TrackingPlan plan() { return TrackingPlan.parse(plan); }
    public boolean configured() { return key.map(String::trim).filter(k -> !k.isEmpty()).isPresent(); }

    public List<Registration> register(List<Parcel> parcels) {
        if (parcels.isEmpty()) return List.of();
        var data = post("/register", body(parcels)).path("data");
        var out = new ArrayList<Registration>();
        for (var a : data.path("accepted")) out.add(new Registration(a.path("number").asText(), true, null, false));
        for (var r : data.path("rejected")) {
            int code = r.path("error").path("code").asInt();
            out.add(new Registration(r.path("number").asText(), code == ALREADY_REGISTERED, code == ALREADY_REGISTERED ? null : reason(code, r.path("error").path("message").asText("")), code == QUOTA_EXHAUSTED));
        }
        return out;
    }

    public List<Report> fetch(List<Parcel> parcels) {
        if (parcels.isEmpty()) return List.of();
        var out = new ArrayList<Report>();
        for (var a : post("/gettrackinfo", body(parcels)).path("data").path("accepted")) out.add(report(a));
        return out;
    }

    static Report report(JsonNode accepted) {
        var info = accepted.path("track_info");
        var events = new ArrayList<TrackingEvent>();
        for (var provider : info.path("tracking").path("providers"))
            for (var e : provider.path("events")) {
                var at = time(e);
                if (at != null) events.add(new TrackingEvent(at, e.path("description").asText(""), e.path("location").asText("")));
            }
        return new Report(accepted.path("number").asText(), stage(info.path("latest_status").path("status").asText(""), info.path("latest_status").path("sub_status").asText("")), events);
    }
    /** 17TRACK's main statuses in the store's words. */
    static TrackingStage stage(String status, String sub) {
        return switch (status) {
            case "InfoReceived" -> TrackingStage.RECEIVED;
            case "InTransit" -> TrackingStage.IN_TRANSIT;
            case "AvailableForPickup" -> TrackingStage.PICKUP_READY;
            case "OutForDelivery" -> TrackingStage.OUT_FOR_DELIVERY;
            case "DeliveryFailure" -> TrackingStage.ATTEMPT_FAILED;
            case "Delivered" -> TrackingStage.DELIVERED;
            case "Exception" -> TrackingStage.EXCEPTION;
            case "Expired" -> TrackingStage.EXPIRED;
            default -> TrackingStage.WAITING;
        };
    }
    private static Instant time(JsonNode e) {
        for (var field : List.of("time_utc", "time_iso")) {
            var text = e.path(field).asText("");
            if (text.isBlank()) continue;
            try { return OffsetDateTime.parse(text).toInstant(); } catch (RuntimeException ignored) { }
            try { return Instant.parse(text); } catch (RuntimeException ignored) { }
        }
        return null;
    }
    private static String reason(int code, String message) {
        return switch (code) {
            case -18010012 -> "El número de guía no tiene un formato válido";
            case -18019903 -> "El servicio de seguimiento no pudo identificar la transportadora de esta guía";
            case -18019910 -> "La transportadora no coincide con el número de guía";
            default -> message.isBlank() ? "El servicio de seguimiento rechazó esta guía" : message;
        };
    }
    private static String body(List<Parcel> parcels) {
        ArrayNode array = JSON.createArrayNode();
        for (var p : parcels) {
            var item = array.addObject().put("number", p.number());
            if (p.carrierKey() != null) item.put("carrier", p.carrierKey());
        }
        return array.toString();
    }
    private JsonNode post(String path, String body) {
        if (!configured()) throw new IllegalStateException("Falta ARISMA_TRACKING_KEY");
        try {
            var response = HTTP.send(HttpRequest.newBuilder(URI.create(base + path)).timeout(Duration.ofSeconds(15))
                .header("17token", key.orElseThrow().trim()).header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body)).build(), HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) throw new IllegalStateException("17TRACK respondió " + response.statusCode());
            var json = JSON.readTree(response.body());
            if (json.path("code").asInt(-1) != 0) throw new IllegalStateException("17TRACK respondió con código " + json.path("code").asText());
            return json;
        } catch (InterruptedException e) { Thread.currentThread().interrupt(); throw new IllegalStateException("Consulta a 17TRACK interrumpida", e); }
        catch (java.io.IOException e) { throw new IllegalStateException("No se pudo conectar con 17TRACK", e); }
    }
}

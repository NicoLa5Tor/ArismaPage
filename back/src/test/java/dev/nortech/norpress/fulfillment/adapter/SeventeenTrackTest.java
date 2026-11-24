package dev.nortech.norpress.fulfillment.adapter;
import static org.junit.jupiter.api.Assertions.*;
import dev.nortech.norpress.fulfillment.domain.TrackingStage;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import org.junit.jupiter.api.Test;

/** Reading 17TRACK's gettrackinfo answer (shape of the v2.2 documentation). */
class SeventeenTrackTest {
    @Test void readsStageAndEvents() throws Exception {
        var accepted = new ObjectMapper().readTree("""
            {"number":"240041234567","carrier":100491,"track_info":{
              "latest_status":{"status":"OutForDelivery","sub_status":"OutForDelivery_Other"},
              "tracking":{"providers":[{"provider":{"key":100491,"name":"Inter Rapidisimo"},"events":[
                {"time_iso":"2026-11-13T08:10:00-05:00","time_utc":"2026-11-13T13:10:00Z","description":"En reparto","location":"BOGOTA"},
                {"time_iso":"2026-11-12T18:00:00-05:00","description":"Admitido","location":""},
                {"description":"sin fecha"}]}]}}}""");
        var report = SeventeenTrack.report(accepted);
        assertEquals("240041234567", report.number());
        assertEquals(TrackingStage.OUT_FOR_DELIVERY, report.stage());
        assertEquals(2, report.events().size());
        assertEquals(Instant.parse("2026-11-13T13:10:00Z"), report.events().get(0).at());
        assertEquals(Instant.parse("2026-11-12T23:00:00Z"), report.events().get(1).at());
        assertEquals("BOGOTA", report.events().get(0).location());
    }
    @Test void unknownStatusWaits() {
        assertEquals(TrackingStage.WAITING, SeventeenTrack.stage("NotFound", ""));
        assertEquals(TrackingStage.DELIVERED, SeventeenTrack.stage("Delivered", "Delivered_Other"));
        assertEquals(TrackingStage.EXCEPTION, SeventeenTrack.stage("Exception", "Exception_Returning"));
    }
    @Test void onlyAPushSignedWithTheKeyIsBelieved() {
        var provider = new SeventeenTrack();
        provider.key = java.util.Optional.of("llave-de-prueba");
        String body = "{\"event\":\"TRACKING_UPDATED\",\"data\":{\"number\":\"700123456789\",\"track_info\":{\"latest_status\":{\"status\":\"Delivered\"}}}}";
        String good = SeventeenTrack.sha256(body + "/llave-de-prueba");
        org.junit.jupiter.api.Assertions.assertTrue(provider.signed(body, good));
        org.junit.jupiter.api.Assertions.assertTrue(provider.signed(body, good.toUpperCase()), "hex case does not matter");
        org.junit.jupiter.api.Assertions.assertFalse(provider.signed(body, SeventeenTrack.sha256(body + "/otra-llave")));
        org.junit.jupiter.api.Assertions.assertFalse(provider.signed(body + " ", good), "a changed body breaks the signature");
        org.junit.jupiter.api.Assertions.assertFalse(provider.signed(body, null));
        var report = SeventeenTrack.pushed(body).orElseThrow();
        org.junit.jupiter.api.Assertions.assertEquals("700123456789", report.number());
        org.junit.jupiter.api.Assertions.assertEquals(dev.nortech.norpress.fulfillment.domain.TrackingStage.DELIVERED, report.stage());
        org.junit.jupiter.api.Assertions.assertTrue(SeventeenTrack.pushed("{\"event\":\"TRACKING_STOPPED\",\"data\":{}}").isEmpty());
    }
}

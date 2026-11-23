package co.com.arisma.fulfillment.adapter;
import static org.junit.jupiter.api.Assertions.*;
import co.com.arisma.fulfillment.domain.TrackingStage;
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
}

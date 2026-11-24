package dev.nortech.norpress.shared.domain;
import static org.junit.jupiter.api.Assertions.*;
import dev.nortech.norpress.shared.domain.Availability.Status;
import org.junit.jupiter.api.Test;

class AvailabilityTest {
    @Test void untrackedStockFollowsTheStoredStatus() {
        assertEquals(new Availability(Status.IN_STOCK, null, 99), Availability.of(false, null, "instock", "no", false));
        assertEquals(new Availability(Status.BACKORDER, null, 99), Availability.of(false, null, "onbackorder", "no", false));
        assertEquals(new Availability(Status.OUT_OF_STOCK, null, 0), Availability.of(false, null, "outofstock", "no", false));
        assertFalse(Availability.of(false, null, "outofstock", "no", false).purchasable());
    }
    @Test void trackedStockCapsTheOrderAndTellsWhenFewRemain() {
        assertEquals(new Availability(Status.IN_STOCK, 3, 3), Availability.of(true, 3, "instock", "no", false));
        assertEquals(new Availability(Status.IN_STOCK, null, 40), Availability.of(true, 40, "instock", "no", false));
        assertEquals(new Availability(Status.IN_STOCK, null, 99), Availability.of(true, 400, "instock", "no", false));
        // with backorders the shelf does not cap the order
        assertEquals(new Availability(Status.IN_STOCK, 2, 99), Availability.of(true, 2, "instock", "yes", false));
    }
    @Test void trackedStockThatRanOutWinsOverAStaleStatus() {
        assertEquals(new Availability(Status.OUT_OF_STOCK, null, 0), Availability.of(true, 0, "instock", "no", false));
        assertEquals(new Availability(Status.OUT_OF_STOCK, null, 0), Availability.of(true, null, "instock", "no", false));
        assertEquals(new Availability(Status.BACKORDER, null, 99), Availability.of(true, 0, "instock", "notify", false));
    }
    @Test void soldIndividuallyMeansOnePerOrder() {
        assertEquals(1, Availability.of(false, null, "instock", "no", true).maxQuantity());
        assertEquals(1, Availability.of(true, 8, "instock", "no", true).maxQuantity());
        assertEquals(0, Availability.of(true, 0, "instock", "no", true).maxQuantity());
    }
}

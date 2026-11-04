package co.com.arisma.shared.domain;
import static org.junit.jupiter.api.Assertions.*;
import java.time.Duration;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
class DateWindowTest {
    private static final LocalDate TODAY = LocalDate.of(2026, 11, 3);
    @Test void reportDefaultsToCurrentYearInclusiveOfToday() {
        var w = DateWindow.report(null, "", TODAY);
        assertEquals(LocalDate.of(2026, 1, 1), w.firstDay());
        assertEquals(TODAY, w.lastDay());
    }
    @Test void toIsInclusive() { assertEquals(LocalDate.of(2026, 3, 31), DateWindow.report("2026-03-01", "2026-03-31", TODAY).lastDay()); }
    @Test void previousHasSameLengthAndEndsAtStart() {
        var w = DateWindow.report("2026-03-01", "2026-03-31", TODAY); var p = w.previous();
        assertEquals(w.start(), p.end());
        assertEquals(Duration.between(w.start(), w.end()), Duration.between(p.start(), p.end()));
    }
    @Test void optionalSidesStayOpen() { var w = DateWindow.optional("", "2026-03-31"); assertNull(w.start()); assertNotNull(w.end()); }
    @Test void rejectsBadInput() {
        assertThrows(IllegalArgumentException.class, () -> DateWindow.report("31/03/2026", null, TODAY));
        assertThrows(IllegalArgumentException.class, () -> DateWindow.report("2026-04-01", "2026-03-01", TODAY));
        assertThrows(IllegalArgumentException.class, () -> DateWindow.report("2000-01-01", "2026-01-01", TODAY));
    }
}

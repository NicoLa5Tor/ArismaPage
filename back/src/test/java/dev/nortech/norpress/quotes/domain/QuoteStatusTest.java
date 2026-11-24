package dev.nortech.norpress.quotes.domain;
import static org.junit.jupiter.api.Assertions.*;
import org.junit.jupiter.api.Test;
class QuoteStatusTest {
    @Test void convertedIsFinal() { assertThrows(IllegalArgumentException.class, () -> QuoteStatus.CONVERTED.requireManualMoveTo(QuoteStatus.PENDING)); }
    @Test void cannotConvertByHand() { assertThrows(IllegalArgumentException.class, () -> QuoteStatus.PENDING.requireManualMoveTo(QuoteStatus.CONVERTED)); }
    @Test void followUpStatusesAreFree() { assertDoesNotThrow(() -> QuoteStatus.PENDING.requireManualMoveTo(QuoteStatus.ACCEPTED)); assertDoesNotThrow(() -> QuoteStatus.EXPIRED.requireManualMoveTo(QuoteStatus.PENDING)); }
    @Test void parse() { assertNull(QuoteStatus.parse(" ")); assertEquals(QuoteStatus.ACCEPTED, QuoteStatus.parse("accepted")); assertThrows(IllegalArgumentException.class, () -> QuoteStatus.parse("x")); }
}

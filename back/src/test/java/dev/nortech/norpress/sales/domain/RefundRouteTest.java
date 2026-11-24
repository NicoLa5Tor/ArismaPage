package dev.nortech.norpress.sales.domain;
import static org.junit.jupiter.api.Assertions.*;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import org.junit.jupiter.api.Test;

/** How money goes back: through the gateway when it can, by transfer otherwise. */
class RefundRouteTest {
    static final Instant NOW = Instant.parse("2026-11-24T15:00:00Z");
    static final BigDecimal AMOUNT = new BigDecimal("120000");
    static RefundRoute.Charge charge(String gateway, String type, Duration ago) { return new RefundRoute.Charge(gateway, type, "tx-1", "ARI1T1", true, NOW.minus(ago)); }

    @Test void wompiRefundsAnyApprovedTransaction() {
        for (String type : new String[]{"CARD", "NEQUI", "PSE", "BANCOLOMBIA_TRANSFER"})
            assertEquals(RefundRoute.WOMPI, RefundRoute.choose(charge("wompi", type, Duration.ofDays(40)), true, AMOUNT, true, false, NOW), type);
    }
    @Test void payuRefundsCardsWithinItsRules() {
        assertEquals(RefundRoute.PAYU, RefundRoute.choose(charge("payu", "VISA", Duration.ofDays(30)), true, AMOUNT, true, false, NOW));
        assertEquals(RefundRoute.TRANSFER, RefundRoute.choose(charge("payu", "PSE", Duration.ofDays(1)), true, AMOUNT, true, false, NOW), "PayU does not refund PSE");
        assertEquals(RefundRoute.TRANSFER, RefundRoute.choose(charge("payu", "VISA", Duration.ofDays(358)), true, AMOUNT, true, false, NOW), "after 357 days");
        assertEquals(RefundRoute.TRANSFER, RefundRoute.choose(charge("payu", "VISA", Duration.ofDays(1)), true, new BigDecimal("99"), true, false, NOW), "under 100 pesos");
        assertEquals(RefundRoute.TRANSFER, RefundRoute.choose(charge("payu", "VISA", Duration.ofDays(1)), true, AMOUNT, false, true, NOW), "one partial refund per order");
    }
    @Test void withoutGatewayOrCredentialsItIsATransfer() {
        assertEquals(RefundRoute.TRANSFER, RefundRoute.choose(null, true, AMOUNT, true, false, NOW), "paid by transfer or in cash");
        assertEquals(RefundRoute.TRANSFER, RefundRoute.choose(charge("wompi", "CARD", Duration.ofDays(1)), false, AMOUNT, true, false, NOW), "no private key");
        assertEquals(RefundRoute.TRANSFER, RefundRoute.choose(new RefundRoute.Charge("wompi", "CARD", "", "R", true, NOW), true, AMOUNT, true, false, NOW), "no transaction id");
    }
    @Test void payuWaitsTenMinutesAfterTheCharge() {
        assertFalse(RefundRoute.readyToSend(RefundRoute.PAYU, charge("payu", "VISA", Duration.ofMinutes(3)), NOW));
        assertTrue(RefundRoute.readyToSend(RefundRoute.PAYU, charge("payu", "VISA", Duration.ofMinutes(11)), NOW));
        assertTrue(RefundRoute.readyToSend(RefundRoute.WOMPI, charge("wompi", "CARD", Duration.ofMinutes(1)), NOW));
    }
    @Test void anAccountIsValidatedAndMasked() {
        var account = new Payout("Bancolombia", "ahorros", "123-456 789 01", "Ana María Pérez", "cc", "1.020.304");
        assertEquals("12345678901", account.number());
        assertEquals("Bancolombia ···8901", account.masked());
        assertEquals(account, Payout.fromMap(account.toMap()));
        var wallet = new Payout("Nequi", "", "3001234567", "Ana María Pérez", "CC", "1020304");
        assertEquals("billetera", wallet.accountType());
        assertThrows(IllegalArgumentException.class, () -> new Payout("Nequi", "", "123", "Ana María Pérez", "CC", "1020304"), "a wallet takes a phone number");
        assertThrows(IllegalArgumentException.class, () -> new Payout("Banco Inventado", "ahorros", "123456789", "Ana María Pérez", "CC", "1020304"));
        assertThrows(IllegalArgumentException.class, () -> new Payout("Davivienda", "billetera", "123456789", "Ana María Pérez", "CC", "1020304"));
        assertThrows(IllegalArgumentException.class, () -> new Payout("Davivienda", "corriente", "12345", "Ana María Pérez", "CC", "1020304"));
        assertThrows(IllegalArgumentException.class, () -> new Payout("Davivienda", "corriente", "123456789", "A1", "CC", "1020304"));
        assertThrows(IllegalArgumentException.class, () -> new Payout("Davivienda", "corriente", "123456789", "Ana María Pérez", "XX", "1020304"));
    }
}

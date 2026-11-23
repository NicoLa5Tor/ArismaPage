package co.com.arisma.payments.domain;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class PaymentStateMessageTest {
    @Test void theGatewaysReasonFollowsThePlainMessage() {
        assertEquals("Hubo un error con el pago: Número no válido en Sandbox", PaymentState.ERROR.message("Número no válido en Sandbox"));
        assertEquals("El pago fue rechazado: Fondos insuficientes", PaymentState.DECLINED.message("  Fondos\ninsuficientes "));
    }
    @Test void withoutAReasonOrWhenApprovedItIsThePlainMessage() {
        assertEquals("Hubo un error con el pago", PaymentState.ERROR.message(null));
        assertEquals("Hubo un error con el pago", PaymentState.ERROR.message("   "));
        assertEquals("Pago aprobado", PaymentState.APPROVED.message("APPROVED"));
    }
    @Test void aLongOrOddReasonIsKeptShortAndPlain() {
        var long_ = PaymentState.ERROR.message("x".repeat(500));
        assertTrue(long_.length() < 200 && long_.endsWith("…"));
        assertFalse(PaymentState.ERROR.message("<script>alert(1)</script>").contains("<"));
    }
}

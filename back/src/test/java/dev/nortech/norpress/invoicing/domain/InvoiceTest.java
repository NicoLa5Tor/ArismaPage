package dev.nortech.norpress.invoicing.domain;

import org.junit.jupiter.api.Test;
import java.nio.charset.StandardCharsets;
import static org.junit.jupiter.api.Assertions.*;

class InvoiceTest {
    @Test void onlyARealPdfIsAccepted() {
        assertDoesNotThrow(() -> Invoice.requirePdf("%PDF-1.7 ...".getBytes(StandardCharsets.US_ASCII)));
        assertThrows(IllegalArgumentException.class, () -> Invoice.requirePdf("<html>factura</html>".getBytes(StandardCharsets.US_ASCII)));
        assertThrows(IllegalArgumentException.class, () -> Invoice.requirePdf(new byte[0]));
        var heavy = new byte[Invoice.MAX_BYTES + 1];
        System.arraycopy("%PDF-".getBytes(StandardCharsets.US_ASCII), 0, heavy, 0, 5);
        assertThrows(IllegalArgumentException.class, () -> Invoice.requirePdf(heavy));
    }

    @Test void numberAndFileName() {
        assertNull(Invoice.number("  "));
        assertEquals("FV 1234", Invoice.number(" FV   1234 "));
        assertThrows(IllegalArgumentException.class, () -> Invoice.number("FV<script>"));
        assertEquals("Factura FV-1234.pdf", Invoice.fileName("FV-1234", "5001"));
        assertEquals("Factura FV-12-3.pdf", Invoice.fileName("FV/12#3", "5001"));
        assertEquals("Factura pedido 5001.pdf", Invoice.fileName(null, "5001"));
    }

    @Test void onlyPaidOrdersAreInvoiced() {
        assertDoesNotThrow(() -> Invoice.requireInvoiceable("completed"));
        assertDoesNotThrow(() -> Invoice.requireInvoiceable("processing"));
        assertThrows(IllegalArgumentException.class, () -> Invoice.requireInvoiceable("cancelled"));
        assertThrows(IllegalArgumentException.class, () -> Invoice.requireInvoiceable("pending"));
    }
}

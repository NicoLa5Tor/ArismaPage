package co.com.arisma.fulfillment.domain;
import java.util.Locale;

/**
 * Where a carrier shipment is, in the store's own words; every provider's statuses are translated into these, so the
 * panel and the shop never learn a provider's vocabulary.
 */
public enum TrackingStage {
    WAITING("Esperando a la transportadora", "La transportadora aún no publica movimientos de esta guía."),
    RECEIVED("Recibido por la transportadora", "La transportadora registró tu envío."),
    IN_TRANSIT("En tránsito", "Tu paquete va camino a tu ciudad."),
    PICKUP_READY("Listo para recoger", "Tu paquete te espera en una oficina de la transportadora."),
    OUT_FOR_DELIVERY("En reparto", "El mensajero ya salió a entregarlo."),
    ATTEMPT_FAILED("Intento de entrega fallido", "La transportadora intentó entregarlo y no pudo."),
    DELIVERED("Entregado", "La transportadora confirmó la entrega."),
    EXCEPTION("Con novedad", "La transportadora reporta una novedad con el envío."),
    EXPIRED("Sin movimientos recientes", "La transportadora no ha publicado movimientos en mucho tiempo.");

    public final String label, text;
    TrackingStage(String label, String text) { this.label = label; this.text = text; }
    public String db() { return name().toLowerCase(Locale.ROOT); }
    public static TrackingStage fromDb(String v) { return v == null ? WAITING : valueOf(v.toUpperCase(Locale.ROOT)); }
    /** The carrier will not move it any further: stop asking. */
    public boolean last() { return this == DELIVERED; }
}

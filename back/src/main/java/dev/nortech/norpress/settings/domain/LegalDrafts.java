package dev.nortech.norpress.settings.domain;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.util.*;

/**
 * A first draft of each legal page, written from what the store really does: who it is (its profile), how it delivers
 * (Shipping), when shoppers may cancel and how long an order waits for payment (CheckoutRules) and how shoppers pay
 * (the active method). It also states what Colombian law gives every shopper (Ley 1480 de 2011 and Ley 1581 de 2012).
 * It is only a starting point: the store reads it, adjusts it with its lawyer and publishes it from the panel.
 */
public final class LegalDrafts {
    private LegalDrafts() {}

    /** What the draft is written from. payment is the label of the active method, or empty. */
    public record Facts(StoreProfile store, Shipping shipping, CheckoutRules checkout, String payment) {}

    public static LegalPages.LegalPage draft(String kind, Facts f) {
        return switch (kind) {
            case "returns" -> returns(f);
            case "shipping" -> shipping(f);
            case "privacy" -> privacy(f);
            case "terms" -> terms(f);
            default -> throw new IllegalArgumentException("Esa página legal no existe");
        };
    }

    static LegalPages.LegalPage returns(Facts f) {
        var d = new Draft("Política de cambios, devoluciones y reembolsos");
        d.p("Esta política explica cuándo puedes cancelar un pedido, cómo te devolvemos el dinero y qué derechos tienes después de recibir tu compra en " + who(f) + ".");
        d.h("Cancelar un pedido antes de que salga");
        if (f.checkout().shopperCancels()) {
            d.p("Mientras tu pedido no haya salido de la tienda (o, si elegiste recogerlo, mientras no lo hayas recogido), puedes cancelarlo tú mismo desde tu cuenta, en el detalle del pedido. No necesitas pedir autorización.");
            d.p("Si ya lo pagaste, el reembolso empieza en ese mismo momento por el valor completo que pagaste.");
        } else {
            d.p("Para cancelar un pedido que todavía no ha salido de la tienda, escríbenos " + contact(f) + ". Revisamos el pedido y, si aún no ha salido, lo cancelamos y te devolvemos lo que pagaste.");
        }
        d.p("Un pedido que no se paga en " + hours(f.checkout().unpaidHours()) + " se cancela solo y los productos vuelven a estar disponibles. En ese caso no hay nada que devolver.");
        d.h("Cuando el pedido ya salió");
        d.p("Cuando el pedido ya fue despachado o entregado, ya no se puede cancelar desde la tienda ni se reembolsa de forma automática. Si quieres devolverlo, ejercer el derecho de retracto o hacer valer la garantía, escríbenos " + contact(f) + " y te indicamos cómo seguir.");
        d.h("Cómo te devolvemos el dinero");
        d.list(
            "Si pagaste con tarjeta u otro medio de la pasarela de pago y la pasarela lo permite, el dinero vuelve por el mismo medio. El tiempo en que lo ves depende de tu banco o de la pasarela.",
            "Si la pasarela no permite devolverlo, o pagaste por transferencia, te lo transferimos a la cuenta bancaria o billetera que nos indiques. Esos datos se guardan cifrados, solo los usamos para el reembolso y los borramos cuando termina.",
            "Te avisamos por correo cuando el reembolso esté hecho, y puedes seguirlo en el detalle de tu pedido.");
        d.p("La ley nos da hasta treinta (30) días calendario para devolverte el dinero en los casos de retracto; procuramos hacerlo mucho antes.");
        d.h("Derecho de retracto");
        d.p("Como compraste a distancia, tienes derecho a retractarte de la compra dentro de los cinco (5) días hábiles siguientes a la entrega del producto (artículo 47 de la Ley 1480 de 2011). Para ejercerlo escríbenos " + contact(f) + " dentro de ese plazo. Debes devolver el producto por los mismos medios y en las mismas condiciones en que lo recibiste: sin uso y con sus empaques. Los costos de transporte de la devolución corren por tu cuenta.");
        d.p("El retracto no aplica, entre otros, a productos hechos según tus especificaciones o personalizados, ni a los que por su naturaleza no pueden devolverse, de acuerdo con la misma ley.");
        d.h("Reversión del pago");
        d.p("Si pagaste con tarjeta de crédito, débito u otro medio electrónico, puedes pedir la reversión del pago cuando hayas sido víctima de fraude, la operación no haya sido solicitada, el producto no se haya recibido, o el producto entregado no corresponda a lo que pediste o tenga defectos (artículo 51 de la Ley 1480 de 2011). Debes presentar la queja ante nosotros dentro de los cinco (5) días hábiles siguientes a la fecha en que conociste el hecho, y avisar también al emisor de tu medio de pago. Si corresponde, debes devolver el producto.");
        d.h("Garantía");
        d.p("Todos los productos tienen la garantía legal de calidad, idoneidad y seguridad (artículos 7 y 8 de la Ley 1480 de 2011), por el término que indique el producto o, si no lo indica, por un (1) año desde la entrega. Para hacerla efectiva escríbenos " + contact(f) + " con el número de tu pedido y una descripción del problema.");
        d.h("Si no quedas conforme");
        d.p("Puedes presentar una petición, queja o reclamo " + contact(f) + ". Si no quedas satisfecho con la respuesta, puedes acudir a la Superintendencia de Industria y Comercio (www.sic.gov.co).");
        return d.page();
    }

    static LegalPages.LegalPage shipping(Facts f) {
        var s = f.shipping();
        var d = new Draft("Política de envíos");
        d.p("Así entregamos los pedidos de " + who(f) + ". El costo del envío se calcula con la dirección que elijas y lo ves antes de pagar.");
        d.h("Costos");
        var costs = new ArrayList<String>();
        String local = f.store().localCity().isEmpty() ? "nuestra zona local" : f.store().localCity();
        costs.add("Envío en " + local + ": " + pesos(s.localRate()) + (s.freeFromLocal() == null ? "." : ". Gratis en compras desde " + pesos(s.freeFromLocal()) + "."));
        costs.add("Envío al resto del país: " + pesos(s.nationalRate()) + ".");
        if (s.pickup()) costs.add("Recoger en la tienda: sin costo" + (f.store().pickupLine().isEmpty() ? "." : ", en " + f.store().pickupLine() + "."));
        if (s.minimumOrder().signum() > 0) costs.add("La compra mínima es de " + pesos(s.minimumOrder()) + ".");
        d.list(costs.toArray(String[]::new));
        d.p("Los valores incluyen IVA.");
        d.h("Tiempos de entrega");
        d.p("Preparamos tu pedido cuando se confirma el pago. El tiempo de entrega depende de la ciudad y de la transportadora: te lo confirmamos al despachar.");
        d.h("Seguimiento");
        d.p("Cuando el pedido sale, te avisamos por correo con la transportadora y el número de guía. También puedes ver cada paso en el detalle de tu pedido, en tu cuenta.");
        d.h("Si algo sale mal con la entrega");
        d.p("Si la transportadora no logra entregar el pedido o llega con daños, escríbenos " + contact(f) + " con el número de tu pedido y lo resolvemos contigo. Los cambios, devoluciones y reembolsos se rigen por nuestra política de cambios, devoluciones y reembolsos.");
        return d.page();
    }

    static LegalPages.LegalPage privacy(Facts f) {
        var d = new Draft("Política de tratamiento de datos personales");
        d.p("Esta política explica cómo " + who(f) + " trata los datos personales de sus clientes, en cumplimiento de la Ley 1581 de 2012 y el Decreto 1377 de 2013.");
        d.h("Responsable del tratamiento");
        d.p(identity(f));
        d.h("Qué datos tratamos y para qué");
        d.list(
            "Los datos de tu cuenta (nombre, correo y contraseña cifrada), para que puedas comprar y seguir tus pedidos.",
            "Los datos de tus pedidos (nombre, documento, teléfono y direcciones de entrega), para preparar, entregar y facturar tus compras.",
            "Las opiniones y preguntas que publiques, con tu nombre y la inicial de tu apellido.",
            "Si te devolvemos dinero por transferencia, la cuenta que nos indiques, guardada cifrada y borrada cuando termina el reembolso.");
        d.p("Los pagos los procesa la pasarela de pago: no recibimos ni guardamos los datos de tu tarjeta.");
        d.h("Tus derechos");
        d.p("Puedes conocer, actualizar, rectificar y pedir la supresión de tus datos, revocar la autorización y pedir prueba de ella. Desde tu cuenta, en «Mis datos», puedes descargar tus datos y eliminar tu cuenta. Para cualquier otra solicitud escríbenos " + contact(f) + ". Respondemos las consultas en diez (10) días hábiles y los reclamos en quince (15) días hábiles.");
        d.h("Cuánto tiempo los guardamos");
        d.p("Mientras tengas tu cuenta. Si la eliminas, borramos tus direcciones y los datos de tu cuenta; los pedidos y facturas se conservan durante el tiempo que exigen las normas contables y tributarias.");
        d.h("Cookies y almacenamiento en tu navegador");
        d.p("Usamos solo una cookie de sesión, necesaria para mantener tu cuenta abierta de forma segura, y guardamos tu carrito en tu propio navegador. No usamos cookies de publicidad ni de rastreo.");
        d.h("Quejas");
        d.p("Si consideras que no atendimos tu solicitud, puedes acudir a la Superintendencia de Industria y Comercio (www.sic.gov.co).");
        return d.page();
    }

    static LegalPages.LegalPage terms(Facts f) {
        var d = new Draft("Términos y condiciones de uso");
        d.p("Estos términos rigen el uso de la tienda en línea de " + who(f) + " y las compras que hagas en ella.");
        d.h("Quiénes somos");
        d.p(identity(f));
        d.h("Precios y pagos");
        d.p("Los precios están en pesos colombianos e incluyen IVA. El costo del envío se muestra antes de pagar." + (f.payment().isEmpty() ? "" : " Recibimos pagos por " + f.payment() + "."));
        d.p("Un pedido queda confirmado cuando se aprueba su pago. Si no se paga en " + hours(f.checkout().unpaidHours()) + ", se cancela solo.");
        d.h("Disponibilidad");
        d.p("Los productos se venden hasta agotar existencias. Si después de pagar un producto no está disponible, te avisamos y te devolvemos el dinero.");
        d.h("Cancelaciones, devoluciones y garantía");
        d.p("Se rigen por nuestra política de cambios, devoluciones y reembolsos y por la Ley 1480 de 2011 (Estatuto del Consumidor).");
        d.h("Datos personales");
        d.p("Tratamos tus datos según nuestra política de tratamiento de datos personales.");
        d.h("Contacto");
        d.p("Escríbenos " + contact(f) + ". Si no quedas satisfecho con nuestra respuesta, puedes acudir a la Superintendencia de Industria y Comercio (www.sic.gov.co).");
        return d.page();
    }

    private static String who(Facts f) { return f.store().legalName().isEmpty() ? f.store().name() : f.store().legalName(); }
    private static String identity(Facts f) {
        var s = f.store();
        var parts = new ArrayList<String>();
        parts.add(who(f) + (s.taxId().isEmpty() ? "" : ", NIT " + s.taxId()));
        if (!s.pickupLine().isEmpty()) parts.add("dirección " + s.pickupLine());
        if (!s.email().isEmpty()) parts.add("correo " + s.email());
        if (!s.phone().isEmpty()) parts.add("teléfono " + s.phone());
        if (!s.whatsapp().isEmpty()) parts.add("WhatsApp " + s.whatsappLabel());
        return String.join(", ", parts) + ".";
    }
    /** "al correo x o por WhatsApp al y": every channel the store gave. */
    private static String contact(Facts f) {
        var s = f.store();
        var ways = new ArrayList<String>();
        if (!s.email().isEmpty()) ways.add("al correo " + s.email());
        if (!s.whatsapp().isEmpty()) ways.add("por WhatsApp al " + s.whatsappLabel());
        if (ways.isEmpty() && !s.phone().isEmpty()) ways.add("al teléfono " + s.phone());
        if (ways.isEmpty()) return "por nuestros canales de atención";
        return ways.size() == 1 ? ways.get(0) : ways.get(0) + " o " + ways.get(1);
    }
    private static String hours(int h) {
        if (h % 24 == 0) { int days = h / 24; return days == 1 ? "un día" : days + " días"; }
        return h == 1 ? "una hora" : h + " horas";
    }
    static String pesos(BigDecimal value) {
        var symbols = DecimalFormatSymbols.getInstance(Locale.ROOT);
        symbols.setGroupingSeparator('.');
        return "$ " + new DecimalFormat("#,##0", symbols).format(value.setScale(0, RoundingMode.HALF_UP));
    }

    private static final class Draft {
        final String title; final List<LegalPages.Block> blocks = new ArrayList<>();
        Draft(String title) { this.title = title; }
        void h(String text) { blocks.add(new LegalPages.Block("heading", text, List.of())); }
        void p(String text) { blocks.add(new LegalPages.Block("paragraph", text, List.of())); }
        void list(String... items) { blocks.add(new LegalPages.Block("list", "", List.of(items))); }
        LegalPages.LegalPage page() { return new LegalPages.LegalPage(title, blocks, List.of()); }
    }
}

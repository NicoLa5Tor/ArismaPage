package co.com.arisma.notifications.domain;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * The store's emails. Short, in the shopper's words, one action each. Everything written by people (names, products)
 * is escaped before it goes into the HTML; links come from the store itself.
 */
public final class Templates {
    private Templates() {}
    public record Line(String title, int quantity, BigDecimal total) {}

    public static Message orderPlaced(Brand brand, String to, String name, String number, List<Line> lines, BigDecimal discount, BigDecimal shipping, BigDecimal total, String method, String link, boolean test) {
        var rows = new ArrayList<String[]>();
        for (var l : lines) rows.add(new String[]{l.quantity() + " × " + l.title(), pesos(l.total())});
        if (discount != null && discount.signum() > 0) rows.add(new String[]{"Cupón", "−" + pesos(discount)});
        rows.add(new String[]{"Envío", shipping == null || shipping.signum() == 0 ? "Sin costo" : pesos(shipping)});
        rows.add(new String[]{"Total", pesos(total)});
        String intro = (test ? "Este es un pedido de prueba: no se hará ningún cobro real. " : "") + "Guardamos tu pedido #" + number + ". "
            + ("Transferencia o acuerdo por WhatsApp".equals(method) ? "Te escribiremos para confirmar el pago." : "Si aún no pagaste, puedes hacerlo desde el enlace.");
        return build(brand, "pedido_recibido", to, (test ? "[Prueba] " : "") + "Recibimos tu pedido #" + number, "Hola, " + first(name), intro, rows, "Ver mi pedido", link,
            "Guarda este correo: el enlace es la forma de seguir tu pedido sin cuenta.");
    }
    public static Message paymentApproved(Brand brand, String to, String name, String number, BigDecimal total, String link) {
        return build(brand, "pago_aprobado", to, "Pago recibido: pedido #" + number, "¡Gracias, " + first(name) + "!", "Recibimos el pago de tu pedido #" + number + " por " + pesos(total) + ". Ya lo estamos alistando.",
            List.of(), link == null ? null : "Ver mi pedido", link, "Te avisaremos cuando salga hacia ti.");
    }
    public static Message orderShipped(Brand brand, String to, String name, String number, String carrier, String tracking, String link) {
        String detail = tracking == null || tracking.isBlank() ? "Tu pedido #" + number + " ya va en camino." : "Tu pedido #" + number + " ya va en camino con " + (carrier == null || carrier.isBlank() ? "la transportadora" : carrier) + ". Número de guía: " + tracking + ".";
        return build(brand, "pedido_despachado", to, "Tu pedido #" + number + " va en camino", "Hola, " + first(name), detail, List.of(), link == null ? null : "Seguir mi envío", link, link == null ? null : "En la página de la transportadora escribe tu número de guía: " + tracking + ".");
    }
    public static Message newOrderForStore(Brand brand, String to, String number, String buyer, BigDecimal total, String method, String panelLink, boolean test) {
        return build(brand, "aviso_tienda", to, (test ? "[Prueba] " : "") + "Pedido nuevo #" + number + " en la tienda", "Pedido nuevo",
            buyer + " hizo el pedido #" + number + " por " + pesos(total) + ". Medio de pago: " + method + ".", List.of(), "Abrir en el panel", panelLink, null);
    }
    public static Message invoice(Brand brand, String to, String name, String orderNumber, String invoiceNumber, String link) {
        String which = invoiceNumber == null || invoiceNumber.isBlank() ? "la factura" : "la factura " + invoiceNumber;
        return build(brand, "factura", to, "Factura de tu pedido #" + orderNumber, "Hola, " + first(name),
            "Te enviamos " + which + " de tu pedido #" + orderNumber + ". La encuentras adjunta en este correo.", List.of(), link == null ? null : "Descargar la factura", link,
            "Gracias por tu compra. Si necesitas algo con la factura, responde este correo.");
    }
    public static Message verifyEmail(Brand brand, String to, String name, String link) {
        return build(brand, "verificar_correo", to, "Confirma tu correo en " + brand.name(), "Hola, " + first(name), "Confirma que este correo es tuyo para que tus opiniones lleven la marca de compra verificada y veas tus pedidos anteriores.",
            List.of(), "Confirmar mi correo", link, "El enlace vence en 24 horas. Si no creaste una cuenta en " + brand.name() + ", ignora este correo.");
    }
    public static Message resetPassword(Brand brand, String to, String name, String link) {
        return build(brand, "recuperar_clave", to, "Elige una contraseña nueva", "Hola, " + first(name), "Pediste cambiar la contraseña de tu cuenta en " + brand.name() + ". Usa este enlace para elegir una nueva.",
            List.of(), "Elegir contraseña", link, "El enlace vence en una hora y sirve una sola vez. Si no lo pediste, ignora este correo: tu contraseña sigue igual.");
    }
    public static Message test(Brand brand, String to) {
        return build(brand, "prueba", to, "Correo de prueba de " + brand.name(), "Todo listo", "Si lees esto, la tienda ya puede enviar correos con el servidor que configuraste.", List.of(), null, null, null);
    }

    private static Message build(Brand brand, String kind, String to, String subject, String greeting, String intro, List<String[]> rows, String action, String link, String footnote) {
        var text = new StringBuilder(greeting).append("\n\n").append(intro).append("\n");
        for (var r : rows) text.append("\n").append(r[0]).append(": ").append(r[1]);
        if (action != null && link != null) text.append("\n\n").append(action).append(": ").append(link);
        if (footnote != null) text.append("\n\n").append(footnote);
        text.append("\n\n").append(brand.signature());

        var html = new StringBuilder("<!doctype html><html lang=\"es\"><body style=\"margin:0;background:#f5f5f4;font-family:Poppins,Segoe UI,sans-serif;color:#1d1a23\">")
            .append("<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\"><tr><td align=\"center\" style=\"padding:32px 16px\">")
            .append("<table role=\"presentation\" width=\"100%\" style=\"max-width:560px;background:#ffffff;border-radius:24px\" cellpadding=\"0\" cellspacing=\"0\"><tr><td style=\"padding:32px\">")
            .append("<p style=\"margin:0 0 24px;font-weight:600;color:").append(brand.color()).append("\">").append(escape(brand.name())).append("</p>")
            .append("<h1 style=\"margin:0 0 16px;font-size:24px\">").append(escape(greeting)).append("</h1>")
            .append("<p style=\"margin:0 0 16px;font-size:16px;line-height:24px;color:#44403c\">").append(escape(intro)).append("</p>");
        if (!rows.isEmpty()) {
            html.append("<table role=\"presentation\" width=\"100%\" style=\"margin:8px 0 16px;font-size:14px\" cellpadding=\"0\" cellspacing=\"0\">");
            for (int i = 0; i < rows.size(); i++) {
                boolean last = i == rows.size() - 1;
                html.append("<tr><td style=\"padding:8px 0;").append(last ? "font-weight:600" : "color:#44403c").append("\">").append(escape(rows.get(i)[0]))
                    .append("</td><td align=\"right\" style=\"padding:8px 0;").append(last ? "font-weight:600" : "").append("\">").append(escape(rows.get(i)[1])).append("</td></tr>");
            }
            html.append("</table>");
        }
        if (action != null && link != null) html.append("<p style=\"margin:24px 0\"><a href=\"").append(escape(link)).append("\" style=\"display:inline-block;background:").append(brand.color()).append(";color:#ffffff;text-decoration:none;font-weight:600;padding:16px 32px;border-radius:999px\">").append(escape(action)).append("</a></p>");
        if (footnote != null) html.append("<p style=\"margin:0;font-size:13px;line-height:20px;color:#78716c\">").append(escape(footnote)).append("</p>");
        html.append("</td></tr></table><p style=\"margin:16px 0 0;font-size:12px;color:#78716c\">").append(escape(brand.signature())).append("</p></td></tr></table></body></html>");
        return new Message(kind, to, subject, text.toString(), html.toString());
    }
    static String escape(String value) {
        if (value == null) return "";
        var out = new StringBuilder(value.length());
        for (char ch : value.toCharArray()) switch (ch) {
            case '<' -> out.append("&lt;"); case '>' -> out.append("&gt;"); case '&' -> out.append("&amp;"); case '"' -> out.append("&quot;"); case '\'' -> out.append("&#39;");
            default -> out.append(ch);
        }
        return out.toString();
    }
    private static String first(String name) { String n = name == null ? "" : name.trim(); return n.isEmpty() ? "cliente" : n.split("\\s+")[0]; }
    static String pesos(BigDecimal value) { return "$" + String.format(Locale.forLanguageTag("es-CO"), "%,d", value.setScale(0, RoundingMode.HALF_UP).longValue()); }
}

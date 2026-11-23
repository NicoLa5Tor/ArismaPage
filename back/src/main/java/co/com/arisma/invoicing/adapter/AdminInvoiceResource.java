package co.com.arisma.invoicing.adapter;
import co.com.arisma.invoicing.application.InvoiceService;
import co.com.arisma.invoicing.domain.Invoice;
import co.com.arisma.shared.adapter.Requires;
import co.com.arisma.shared.domain.Permission;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.*;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import java.util.*;

/** The invoice of an order from the panel: attach the PDF, send it by email or WhatsApp, or mark it as not needed. */
@Path("/api/admin/orders/{id}/invoice") @Produces(MediaType.APPLICATION_JSON)
public class AdminInvoiceResource {
    @Inject InvoiceService invoices;
    @Context jakarta.ws.rs.container.ContainerRequestContext context;
    @ConfigProperty(name = "arisma.public-url", defaultValue = "http://localhost:8000") String site;
    public record Email(String to) {}

    @GET public Map<String, Object> get(@PathParam("id") UUID id) { return view(invoices.of(id).orElse(null)); }

    @Requires(Permission.ORDERS_MANAGE) @POST @Consumes(MediaType.APPLICATION_OCTET_STREAM)
    public Response attach(@PathParam("id") UUID id, @QueryParam("numero") String number, byte[] pdf) { return Response.status(201).entity(view(invoices.attach(id, pdf, number, actor()))).build(); }

    @Requires(Permission.ORDERS_MANAGE) @POST @Path("/email") @Consumes(MediaType.APPLICATION_JSON)
    public Map<String, Object> email(@PathParam("id") UUID id, Email in) { return view(invoices.sendEmail(id, in == null ? null : in.to(), site, actor())); }

    @Requires(Permission.ORDERS_MANAGE) @POST @Path("/whatsapp")
    public Map<String, Object> whatsapp(@PathParam("id") UUID id) { return view(invoices.markWhatsapp(id, actor())); }

    @Requires(Permission.ORDERS_MANAGE) @POST @Path("/not-needed")
    public Map<String, Object> notNeeded(@PathParam("id") UUID id) { return view(invoices.notNeeded(id, actor())); }

    /** The PDF itself, to check it from the panel before sending. */
    @GET @Path("/file") @Produces("application/pdf")
    public Response file(@PathParam("id") UUID id) {
        var file = invoices.file(id);
        return Response.ok(file.bytes(), "application/pdf").header("Content-Disposition", "inline; filename=\"" + ascii(file.fileName()) + "\"").header("Cache-Control", "no-store").build();
    }

    /** What the panel shows; the link is the one the customer gets. */
    private Map<String, Object> view(Invoice invoice) {
        var out = new LinkedHashMap<String, Object>();
        out.put("status", invoice == null ? "pending" : invoice.status().db());
        out.put("number", invoice == null ? null : invoice.number());
        out.put("fileName", invoice == null ? null : invoice.fileName());
        out.put("channels", invoice == null ? List.of() : invoice.channels());
        out.put("link", invoice != null && invoice.hasFile() ? InvoiceService.link(site, invoice) : null);
        return out;
    }
    static String ascii(String name) { return name.replaceAll("[^A-Za-z0-9 ._-]", "_"); }
    private UUID actor() { return (UUID) context.getProperty("adminUser"); }
}

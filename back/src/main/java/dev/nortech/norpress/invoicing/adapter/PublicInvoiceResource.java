package dev.nortech.norpress.invoicing.adapter;
import dev.nortech.norpress.invoicing.application.InvoiceService;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.Response;

/** The customer's download link for an invoice. The random token is the only key; nothing else about the order is exposed. */
@Path("/api/public/invoices")
public class PublicInvoiceResource {
    @Inject InvoiceService invoices;

    @GET @Path("/{token}") @Produces("application/pdf")
    public Response download(@PathParam("token") String token) {
        var file = invoices.download(token);
        return Response.ok(file.bytes(), "application/pdf")
            .header("Content-Disposition", "attachment; filename=\"" + AdminInvoiceResource.ascii(file.fileName()) + "\"")
            .header("Cache-Control", "private, no-store").header("X-Robots-Tag", "noindex").build();
    }
}

package dev.nortech.norpress.settings.adapter;
import dev.nortech.norpress.settings.application.LegalService;
import dev.nortech.norpress.settings.domain.ErrorPages;
import dev.nortech.norpress.settings.domain.LegalPages;
import dev.nortech.norpress.shared.adapter.Requires;
import dev.nortech.norpress.shared.domain.Permission;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.*;

/**
 * The panel's «Sitio» section: the store's legal documents (drafts, publishing, versions, attached PDFs) and its own
 * error pages. Error pages run the store's JavaScript, so only whoever manages the store's settings edits them.
 */
@Path("/api/admin/site") @Produces(MediaType.APPLICATION_JSON) @Consumes(MediaType.APPLICATION_JSON) @Requires(Permission.SETTINGS_MANAGE)
public class AdminSiteResource {
    @Inject LegalService legal;
    @Context ContainerRequestContext context;

    @GET @Path("/legal") public List<LegalService.Overview> legal() { return legal.overview(); }
    @PUT @Path("/legal/{kind}") public List<LegalService.Overview> saveDraft(@PathParam("kind") String kind, Map<String, Object> in) {
        if (in == null) throw new IllegalArgumentException("Datos requeridos");
        legal.saveDraft(kind, LegalPages.LegalPage.fromMap(in), actor());
        return legal.overview();
    }
    /** A first draft written from the store's real rules, only over an empty page. */
    @POST @Path("/legal/{kind}/draft") public List<LegalService.Overview> draft(@PathParam("kind") String kind) { legal.generateDraft(kind, actor()); return legal.overview(); }
    @POST @Path("/legal/{kind}/publish") public List<LegalService.Overview> publish(@PathParam("kind") String kind) { legal.publish(kind, actor()); return legal.overview(); }
    /** Uploads a PDF under ?name=; the same name replaces it. Attach it to a page by saving its draft. */
    @POST @Path("/legal/files") @Consumes({"application/pdf", MediaType.APPLICATION_OCTET_STREAM})
    public Map<String, String> upload(@QueryParam("name") String name, byte[] bytes) { legal.storeFile(name, bytes); return Map.of("file", name); }
    /** A PDF of a draft or a published page, for the panel's preview. */
    @GET @Path("/legal/files/{file}") @Produces("application/pdf") public Response file(@PathParam("file") String file) {
        var stored = legal.file(file, true);
        return Response.ok(stored.bytes(), "application/pdf").header("Content-Disposition", "inline; filename=\"" + file + "\"").header("Cache-Control", "no-store").build();
    }

    @GET @Path("/error-pages") public Map<String, Object> errorPages() { return legal.errorPages().toMap(); }
    @PUT @Path("/error-pages/{kind}") public Map<String, Object> saveErrorPage(@PathParam("kind") String kind, Map<String, Object> in) {
        if (in == null) throw new IllegalArgumentException("Datos requeridos");
        legal.saveErrorPage(kind, ErrorPages.Page.fromMap(in), actor());
        return legal.errorPages().toMap();
    }

    private UUID actor() { return (UUID) context.getProperty("adminUser"); }
}

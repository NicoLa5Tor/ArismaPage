package dev.nortech.norpress.settings.adapter;
import dev.nortech.norpress.settings.application.StoreSettingsService;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import dev.nortech.norpress.settings.domain.LegalPages;
import dev.nortech.norpress.shared.domain.NotFound;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

/** Who the store is, for any front: name, legal data, address, contact, legal pages (and which of its own it publishes), brand colour and its delivery terms. All of it is public. */
@Path("/api/public/store") @Produces(MediaType.APPLICATION_JSON)
public class PublicStoreResource {
    @Inject StoreSettingsService settings;
    /** Turnstile's public key: fronts show the challenge only when the store set one (NORPRESS_TURNSTILE_SITE_KEY). */
    @org.eclipse.microprofile.config.inject.ConfigProperty(name = "norpress.turnstile.site-key") java.util.Optional<String> turnstileSiteKey;
    @GET public Response store() {
        var out = new java.util.LinkedHashMap<>(settings.profile().toMap());
        out.put("pickupLine", settings.profile().pickupLine());
        out.put("whatsappLabel", settings.profile().whatsappLabel());
        out.put("shipping", settings.shipping().toMap());
        out.put("turnstileSiteKey", turnstileSiteKey.orElse(""));
        out.put("legal", java.util.Map.of("terms", settings.legal().terms().published(), "privacy", settings.legal().privacy().published()));
        return Response.ok(out).header("Cache-Control", "public, max-age=60").build();
    }
    /** A legal page, "terms" or "privacy", as the store wrote it. Not found while the store has not published it. */
    @GET @Path("/legal/{kind}") public Response legal(@PathParam("kind") String kind) {
        var page = settings.legal().page(kind).filter(LegalPages.LegalPage::published).orElseThrow(() -> new NotFound("Esa página legal no existe"));
        return Response.ok(page.toMap()).header("Cache-Control", "public, max-age=60").build();
    }
    /** A document a legal page attaches, shown inside the page. */
    @GET @Path("/legal/files/{file}") @Produces("application/pdf") public Response legalFile(@PathParam("file") String file) {
        var stored = settings.legalFile(file);
        return Response.ok(stored.bytes(), "application/pdf").header("Content-Disposition", "inline; filename=\"" + file + "\"")
            .header("Cache-Control", "public, max-age=300").header("X-Content-Type-Options", "nosniff").build();
    }
}

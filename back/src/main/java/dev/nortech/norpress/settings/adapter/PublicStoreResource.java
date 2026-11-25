package dev.nortech.norpress.settings.adapter;
import dev.nortech.norpress.settings.application.StoreSettingsService;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import dev.nortech.norpress.shared.domain.NotFound;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

/** Who the store is, for any front: name, legal data, address, contact, legal pages (and which of its own it publishes), brand colour and its delivery terms. All of it is public. */
@Path("/api/public/store") @Produces(MediaType.APPLICATION_JSON)
public class PublicStoreResource {
    @Inject StoreSettingsService settings;
    @Inject dev.nortech.norpress.settings.application.LegalService legal;
    /** Turnstile's public key: fronts show the challenge only when the store set one (NORPRESS_TURNSTILE_SITE_KEY). */
    @org.eclipse.microprofile.config.inject.ConfigProperty(name = "norpress.turnstile.site-key") java.util.Optional<String> turnstileSiteKey;
    @GET public Response store() {
        var out = new java.util.LinkedHashMap<>(settings.profile().toMap());
        out.put("pickupLine", settings.profile().pickupLine());
        out.put("whatsappLabel", settings.profile().whatsappLabel());
        out.put("shipping", settings.shipping().toMap());
        out.put("turnstileSiteKey", turnstileSiteKey.orElse(""));
        out.put("legal", legal.publishedKinds());
        // the line about cancelling that the checkout shows next to the terms
        out.put("shopperCancels", settings.checkout().shopperCancels());
        // how shoppers pay right now, so the pages never promise a method the checkout does not offer
        out.put("payment", settings.activeGateway().map(g -> (Object) java.util.Map.of("code", g.code().db(), "label", g.code().label)).orElse(null));
        return Response.ok(out).header("Cache-Control", "public, max-age=60").build();
    }
    /** A legal page (terms, privacy, returns, shipping) in its latest published version. Not found while the store has not published it. */
    @GET @Path("/legal/{kind}") public Response legal(@PathParam("kind") String kind) {
        var published = legal.published(kind).orElseThrow(() -> new NotFound("Esa página legal no existe"));
        var out = new java.util.LinkedHashMap<>(published.page().toMap());
        out.put("version", published.version());
        out.put("publishedAt", published.publishedAt());
        return Response.ok(out).header("Cache-Control", "public, max-age=60").build();
    }
    /** The store's own error page ("not_found" or "error") while it has it on; not found otherwise, and the front shows its own. */
    @GET @Path("/error-pages/{kind}") public Response errorPage(@PathParam("kind") String kind) {
        var page = legal.liveErrorPage(kind).orElseThrow(() -> new NotFound("La tienda no tiene esa página"));
        return Response.ok(java.util.Map.of("html", page.html(), "css", page.css(), "js", page.js())).header("Cache-Control", "public, max-age=60").build();
    }
    /** A document a legal page attaches, shown inside the page. */
    @GET @Path("/legal/files/{file}") @Produces("application/pdf") public Response legalFile(@PathParam("file") String file) {
        var stored = legal.file(file, false);
        return Response.ok(stored.bytes(), "application/pdf").header("Content-Disposition", "inline; filename=\"" + file + "\"")
            .header("Cache-Control", "public, max-age=300").header("X-Content-Type-Options", "nosniff").build();
    }
}

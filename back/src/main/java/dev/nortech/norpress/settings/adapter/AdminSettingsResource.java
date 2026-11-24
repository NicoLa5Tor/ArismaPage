package dev.nortech.norpress.settings.adapter;
import dev.nortech.norpress.catalog.domain.PageSections;
import dev.nortech.norpress.settings.application.StoreSettingsService;
import dev.nortech.norpress.settings.domain.*;
import dev.nortech.norpress.shared.adapter.Requires;
import dev.nortech.norpress.shared.domain.Permission;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import java.util.*;

/** Store configuration. Reading needs the same permission as writing: it shows which payment credentials are set up. */
@Path("/api/admin/settings") @Produces(MediaType.APPLICATION_JSON) @Consumes(MediaType.APPLICATION_JSON) @Requires(Permission.SETTINGS_MANAGE)
public class AdminSettingsResource {
    @Inject StoreSettingsService settings;
    @Context ContainerRequestContext context;

    /** Credentials as the panel sees them: public fields, and for each secret only the dots and last characters. */
    public record CredentialsView(boolean complete, Map<String, String> config, Map<String, String> secrets) {
        static CredentialsView of(Gateway g) {
            var hints = new LinkedHashMap<String, String>();
            for (String field : g.code().secretFields) hints.put(field, Objects.toString(Gateway.hint(g.secrets().get(field)), ""));
            return new CredentialsView(g.complete(), g.config(), hints);
        }
    }
    public record GatewayView(String code, String label, boolean environments, List<String> publicFields, List<String> secretFields, CredentialsView test, CredentialsView live) {}
    /** active is "" when no method is set; mode is "test" or "live"; ready says shoppers can pay right now. */
    public record PaymentsView(String active, String mode, boolean ready, List<GatewayView> gateways) {}
    public record View(Map<String, Object> store, Map<String, Object> conversations, Map<String, Object> shipping, Map<String, Object> checkout, Map<String, String> productPage, PaymentsView payments) {}
    public record PaymentsInput(String active, String mode) {}
    public record CredentialsInput(Map<String, String> config, Map<String, String> secrets) {}

    @GET public View all() {
        return new View(settings.profile().toMap(), settings.conversations().toMap(), settings.shipping().toMap(), settings.checkout().toMap(), settings.pageSections().toKeys(), payments());
    }
    @GET @Path("/payments") public PaymentsView payments() {
        var current = settings.payments();
        var gateways = new ArrayList<GatewayView>();
        for (var code : Gateway.Code.values()) gateways.add(new GatewayView(code.db(), code.label, code.hasEnvironments(), code.publicFields, code.secretFields,
            code.hasEnvironments() ? CredentialsView.of(settings.credentials(code, true)) : null, CredentialsView.of(settings.credentials(code, false))));
        return new PaymentsView(current.active() == null ? "" : current.active().db(), current.test() ? "test" : "live", settings.activeGateway().isPresent(), gateways);
    }
    @PUT @Path("/payments") public PaymentsView choose(PaymentsInput in) {
        if (in == null) throw new IllegalArgumentException("Datos requeridos");
        var active = in.active() == null || in.active().isBlank() ? null : Gateway.Code.parse(in.active());
        if (in.mode() == null || !(in.mode().equals("test") || in.mode().equals("live"))) throw new IllegalArgumentException("Elige pruebas o producción");
        settings.save(new PaymentSettings(active, in.mode().equals("test")), actor());
        return payments();
    }
    @PUT @Path("/payments/{code}/{environment}") public PaymentsView credentials(@PathParam("code") String code, @PathParam("environment") String environment, CredentialsInput in) {
        if (in == null) throw new IllegalArgumentException("Datos del medio de pago requeridos");
        if (!environment.equals("test") && !environment.equals("live")) throw new IllegalArgumentException("Entorno inválido");
        settings.saveCredentials(Gateway.Code.parse(code), environment.equals("test"), in.config(), in.secrets(), actor());
        return payments();
    }
    /** The mail server; the password is never sent back, only whether one is stored. */
    public record MailView(Map<String, Object> settings, boolean passwordStored) {}
    public record MailInput(String host, Integer port, String security, String username, String password, String fromAddress, String fromName, String storeInbox) {}
    @GET @Path("/mail") public MailView mail() { return new MailView(settings.mail().toMap(), settings.mailPasswordStored()); }
    @PUT @Path("/mail") public MailView saveMail(MailInput in) {
        if (in == null) throw new IllegalArgumentException("Datos del correo requeridos");
        MailSettings.Security security;
        try { security = MailSettings.Security.valueOf(in.security() == null ? "STARTTLS" : in.security().toUpperCase(java.util.Locale.ROOT)); } catch (IllegalArgumentException e) { throw new IllegalArgumentException("Seguridad inválida"); }
        settings.save(new MailSettings(in.host(), in.port() == null ? 587 : in.port(), security, in.username(), in.fromAddress(), in.fromName(), in.storeInbox()), in.password(), actor());
        return mail();
    }
    @GET @Path("/store") public Map<String, Object> store() { return settings.profile().toMap(); }
    @PUT @Path("/store") public Map<String, Object> store(Map<String, Object> in) { return settings.save(StoreProfile.fromMap(require(in)), actor()).toMap(); }
    @GET @Path("/legal") public Map<String, Object> legal() { return settings.legal().toMap(); }
    @PUT @Path("/legal") public Map<String, Object> legal(Map<String, Object> in) { return settings.save(LegalPages.fromMap(require(in)), actor()).toMap(); }
    /** Uploads a PDF for the legal pages under ?name=; the same name replaces it. Attach it to a page with PUT /legal. */
    @POST @Path("/legal/files") @Consumes({"application/pdf", MediaType.APPLICATION_OCTET_STREAM})
    public Map<String, String> legalFile(@QueryParam("name") String name, byte[] bytes) { settings.storeLegalFile(name, bytes); return Map.of("file", name); }
    @PUT @Path("/conversations") public Map<String, Object> conversations(Map<String, Object> in) { return settings.save(Conversations.fromMap(require(in)), actor()).toMap(); }
    @PUT @Path("/shipping") public Map<String, Object> shipping(Map<String, Object> in) { return settings.save(Shipping.fromMap(require(in)), actor()).toMap(); }
    @PUT @Path("/checkout") public Map<String, Object> checkout(Map<String, Object> in) {
        if (!(require(in).get("unpaidHours") instanceof Number hours)) throw new IllegalArgumentException("Indica el plazo para pagar en horas");
        // left out, the switch keeps what the store had
        boolean cancels = in.get("shopperCancels") instanceof Boolean b ? b : settings.checkout().shopperCancels();
        return settings.save(new CheckoutRules(hours.intValue(), cancels), actor()).toMap();
    }
    @PUT @Path("/product-page") public Map<String, String> productPage(Map<String, String> in) { return settings.save(PageSections.parse(in), actor()).toKeys(); }
    private UUID actor() { return (UUID) context.getProperty("adminUser"); }
    private static <T> T require(T in) { if (in == null) throw new IllegalArgumentException("Datos requeridos"); return in; }
}

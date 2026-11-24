package dev.nortech.norpress.settings.application;
import dev.nortech.norpress.catalog.domain.PageSections;
import dev.nortech.norpress.media.application.ObjectStore;
import dev.nortech.norpress.shared.domain.NotFound;
import dev.nortech.norpress.settings.application.SettingsPorts.*;
import dev.nortech.norpress.settings.domain.*;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import java.util.*;

/**
 * Everything the administrator configures for the public store. Other modules read it from here; a key that was never
 * saved answers its default, so the store works before anyone opens the settings.
 */
@ApplicationScoped
public class StoreSettingsService {
    public static final String PAGE_KEY = "product_page";
    @Inject SettingsRepository settings;
    @Inject CredentialRepository credentials;
    @Inject SecretVault vault;
    @Inject ObjectStore files;

    public StoreProfile profile() { return StoreProfile.fromMap(settings.read(StoreProfile.KEY).orElse(null)); }
    public Conversations conversations() { return Conversations.fromMap(settings.read(Conversations.KEY).orElse(null)); }
    public Shipping shipping() { return Shipping.fromMap(settings.read(Shipping.KEY).orElse(null)); }
    public CheckoutRules checkout() { return CheckoutRules.fromMap(settings.read(CheckoutRules.KEY).orElse(null)); }
    public PaymentSettings payments() { return PaymentSettings.fromMap(settings.read(PaymentSettings.KEY).orElse(null)); }
    public TrackingSettings tracking() { return TrackingSettings.fromMap(settings.read(TrackingSettings.KEY).orElse(null)); }
    /** Store-wide choice per section of the product page; a section left out is shown. */
    public PageSections pageSections() {
        var stored = settings.read(PAGE_KEY).orElse(Map.of());
        var choices = new LinkedHashMap<String, String>();
        stored.forEach((key, value) -> choices.put(key, Objects.toString(value, "")));
        try { return PageSections.parse(choices); } catch (IllegalArgumentException e) { return PageSections.INHERIT_ALL; }
    }

    public LegalPages legal() { return LegalPages.fromMap(settings.read(LegalPages.KEY).orElse(null)); }
    /** Every document a page attaches must already be stored, so a page never links to a missing file. */
    @Transactional public LegalPages save(LegalPages value, UUID actor) {
        for (var page : List.of(value.terms(), value.privacy())) for (var document : page.documents()) {
            try { files.get(LEGAL_FILES + document.file()); }
            catch (NotFound e) { throw new IllegalArgumentException("Sube primero el archivo " + document.file()); }
        }
        settings.write(LegalPages.KEY, value.toMap(), actor);
        return value;
    }
    /** A PDF for the legal pages, stored under its name; the same name replaces it. */
    public void storeLegalFile(String file, byte[] bytes) {
        if (file == null || !LegalPages.Document.FILE.matcher(file).matches()) throw new IllegalArgumentException("El documento debe ser un PDF con un nombre en minúsculas, sin espacios");
        if (bytes == null || bytes.length < 5 || !new String(bytes, 0, 5, java.nio.charset.StandardCharsets.US_ASCII).equals("%PDF-")) throw new IllegalArgumentException("El archivo no es un PDF");
        if (bytes.length > 15 * 1024 * 1024) throw new IllegalArgumentException("El PDF admite hasta 15 MB");
        files.put(LEGAL_FILES + file, bytes, "application/pdf");
    }
    /** A document of a published legal page; any other name is not found. */
    public ObjectStore.StoredObject legalFile(String file) {
        if (file == null || !legal().attaches(file)) throw new NotFound("Ese documento no existe");
        return files.get(LEGAL_FILES + file);
    }
    static final String LEGAL_FILES = "legal/";

    @Transactional public StoreProfile save(StoreProfile value, UUID actor) { settings.write(StoreProfile.KEY, value.toMap(), actor); return value; }
    @Transactional public Conversations save(Conversations value, UUID actor) { settings.write(Conversations.KEY, value.toMap(), actor); return value; }
    @Transactional public Shipping save(Shipping value, UUID actor) { settings.write(Shipping.KEY, value.toMap(), actor); return value; }
    @Transactional public TrackingSettings save(TrackingSettings value, UUID actor) { settings.write(TrackingSettings.KEY, value.toMap(), actor); return value; }
    @Transactional public CheckoutRules save(CheckoutRules value, UUID actor) { settings.write(CheckoutRules.KEY, value.toMap(), actor); return value; }
    @Transactional public PageSections save(PageSections value, UUID actor) { settings.write(PAGE_KEY, new LinkedHashMap<>(value.toKeys()), actor); return value; }

    public MailSettings mail() { return MailSettings.fromMap(settings.read(MailSettings.KEY).orElse(null)); }
    /** The mail server password, opened: for the mail adapter only. Null when none was saved. */
    public String mailPassword() {
        return settings.read(MAIL_SECRET_KEY).map(m -> m.get("sealed")).map(Object::toString).map(vault::open).map(m -> m.get("password")).orElse(null);
    }
    public boolean mailPasswordStored() { return settings.read(MAIL_SECRET_KEY).isPresent(); }
    /** A blank password keeps the stored one. */
    @Transactional
    public MailSettings save(MailSettings value, String newPassword, UUID actor) {
        settings.write(MailSettings.KEY, value.toMap(), actor);
        if (newPassword != null && !newPassword.isBlank()) {
            if (newPassword.length() > 500) throw new IllegalArgumentException("La contraseña del correo es demasiado larga");
            settings.write(MAIL_SECRET_KEY, Map.of("sealed", vault.seal(Map.of("password", newPassword))), actor);
        }
        return value;
    }
    static final String MAIL_SECRET_KEY = "mail_secret";

    /** The store's 17TRACK Security Key, opened: for the tracking adapter only. Null when the panel has none. */
    public String trackingKey() {
        return settings.read(TRACKING_SECRET_KEY).map(m -> m.get("sealed")).map(Object::toString).map(vault::open).map(m -> m.get("key")).filter(k -> !k.isBlank()).orElse(null);
    }
    /** The key saved from the panel (sealed), or removed with null. */
    @Transactional
    public void saveTrackingKey(String key, UUID actor) {
        settings.write(TRACKING_SECRET_KEY, key == null ? Map.of() : Map.of("sealed", vault.seal(Map.of("key", key))), actor);
    }
    static final String TRACKING_SECRET_KEY = "tracking_secret";

    /** Credentials of a method in one environment, secrets opened: for the server side of a payment only. */
    public Gateway credentials(Gateway.Code code, boolean test) {
        boolean environment = code.hasEnvironments() && test;
        return credentials.all().stream().filter(c -> c.code() == code && c.test() == environment).findFirst()
            .map(c -> new Gateway(c.code(), c.test(), c.config(), c.sealedSecrets() == null ? Map.of() : vault.open(c.sealedSecrets())))
            .orElseGet(() -> new Gateway(code, environment, Map.of(), Map.of()));
    }
    /** Every method in every environment it has, for the panel. */
    public List<Gateway> allCredentials() {
        var out = new ArrayList<Gateway>();
        for (var code : Gateway.Code.values()) {
            if (code.hasEnvironments()) out.add(credentials(code, true));
            out.add(credentials(code, false));
        }
        return out;
    }
    /** The one method shoppers pay with right now, in the mode in use; empty when none is ready. */
    public Optional<Gateway> activeGateway() {
        var current = payments();
        if (current.active() == null) return Optional.empty();
        var gateway = credentials(current.active(), current.test());
        return gateway.complete() ? Optional.of(gateway) : Optional.empty();
    }

    @Transactional
    public PaymentSettings save(PaymentSettings value, UUID actor) {
        if (value.active() != null) value.requireReady(credentials(value.active(), value.test()));
        settings.write(PaymentSettings.KEY, value.toMap(), actor);
        return value;
    }
    /** A secret left blank keeps the stored one. Credentials in use cannot be left incomplete. */
    @Transactional
    public Gateway saveCredentials(Gateway.Code code, boolean test, Map<String, String> config, Map<String, String> newSecrets, UUID actor) {
        var next = credentials(code, test).merge(config, newSecrets);
        next.requireMatchingEnvironment();
        var current = payments();
        if (current.active() == code && (!code.hasEnvironments() || current.test() == next.test()) && !next.complete())
            throw new IllegalArgumentException(code.label + " está activo en " + next.environment() + ": no puede quedar con datos incompletos");
        credentials.save(new StoredCredentials(code, next.test(), next.config(), next.secrets().isEmpty() ? null : vault.seal(next.secrets())), actor);
        return next;
    }
}

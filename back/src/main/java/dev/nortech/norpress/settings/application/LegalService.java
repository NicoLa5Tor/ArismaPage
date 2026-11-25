package dev.nortech.norpress.settings.application;
import dev.nortech.norpress.media.application.ObjectStore;
import dev.nortech.norpress.settings.application.SettingsPorts.*;
import dev.nortech.norpress.settings.domain.ErrorPages;
import dev.nortech.norpress.settings.domain.LegalDrafts;
import dev.nortech.norpress.settings.domain.LegalPages;
import dev.nortech.norpress.shared.domain.Conflict;
import dev.nortech.norpress.shared.domain.NotFound;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import java.util.*;

/**
 * The store's site pages: its legal documents and its own error pages.
 *
 * Legal documents are drafts until the store publishes them; each publication is a new version that is never changed,
 * so the store can always show which text a shopper accepted, when, and from where. Shoppers only ever read and
 * accept the latest published version.
 */
@ApplicationScoped
public class LegalService {
    @Inject SettingsRepository settings;
    @Inject LegalRepository versions;
    @Inject StoreSettingsService store;
    @Inject ObjectStore files;
    static final String FILES = "legal/";

    /** For the panel: each kind with its draft, its latest version and whether the draft differs from it. */
    public record Overview(String kind, LegalPages.LegalPage draft, Published published, boolean changed, List<Published> history) {}
    public record Published(int version, String title, java.time.Instant publishedAt) {
        static Published of(LegalVersion v) { return new Published(v.version(), v.page().title(), v.publishedAt()); }
    }

    public LegalPages drafts() { return LegalPages.fromMap(settings.read(LegalPages.KEY).orElse(null)); }
    public List<Overview> overview() {
        var drafts = drafts();
        var out = new ArrayList<Overview>();
        for (String kind : LegalPages.KINDS) {
            var draft = drafts.page(kind).orElseThrow();
            var all = versions.versions(kind);
            var latest = all.isEmpty() ? null : all.get(0);
            boolean changed = draft.published() && (latest == null || !latest.page().equals(draft));
            out.add(new Overview(kind, draft, latest == null ? null : Published.of(latest), changed, all.stream().map(Published::of).toList()));
        }
        return out;
    }

    /** Saves the draft of one page. Every document it attaches must already be stored, so a page never links to a missing file. */
    @Transactional
    public LegalPages.LegalPage saveDraft(String kind, LegalPages.LegalPage page, UUID actor) {
        if (!LegalPages.known(kind)) throw new NotFound("Esa página legal no existe");
        requireFiles(page);
        settings.write(LegalPages.KEY, drafts().with(kind, page).toMap(), actor);
        return page;
    }
    /** Writes a first draft from what the store really does; never over a draft the store already wrote. */
    @Transactional
    public LegalPages.LegalPage generateDraft(String kind, UUID actor) {
        if (!LegalPages.known(kind)) throw new NotFound("Esa página legal no existe");
        if (drafts().page(kind).orElseThrow().published()) throw new Conflict("Esta página ya tiene texto. Vacíala primero si quieres empezar desde el borrador sugerido.");
        var active = store.activeGateway().map(g -> g.code().label).orElse("");
        var page = LegalDrafts.draft(kind, new LegalDrafts.Facts(store.profile(), store.shipping(), store.checkout(), active));
        settings.write(LegalPages.KEY, drafts().with(kind, page).toMap(), actor);
        return page;
    }
    /** Publishes the draft as the next version. From now on shoppers read and accept it. */
    @Transactional
    public Published publish(String kind, UUID actor) {
        if (!LegalPages.known(kind)) throw new NotFound("Esa página legal no existe");
        var draft = drafts().page(kind).orElseThrow();
        if (!draft.published()) throw new IllegalArgumentException("Escribe la página antes de publicarla");
        if (draft.title().isBlank()) throw new IllegalArgumentException("Escribe el título de la página");
        requireFiles(draft);
        var latest = versions.latest(kind);
        if (latest.isPresent() && latest.get().page().equals(draft)) throw new Conflict("Esta versión ya está publicada: no hay cambios por publicar");
        return Published.of(versions.publish(kind, draft, actor));
    }

    /** The page shoppers read: the latest published version. */
    public Optional<LegalVersion> published(String kind) { return LegalPages.known(kind) ? versions.latest(kind) : Optional.empty(); }
    public Map<String, Boolean> publishedKinds() {
        var out = new LinkedHashMap<String, Boolean>();
        for (String kind : LegalPages.KINDS) out.put(kind, versions.latest(kind).isPresent());
        return out;
    }

    /**
     * Records that someone accepted the documents of those kinds the store has published, in their latest version.
     * A kind the store has not published is skipped: there is nothing to accept.
     */
    @Transactional
    public void accept(List<String> kinds, String context, String orderNumber, UUID accountId, String ip, String userAgent) {
        var rows = new ArrayList<Acceptance>();
        for (String kind : kinds) versions.latest(kind).ifPresent(v -> rows.add(new Acceptance(v.id(), context, orderNumber, accountId, clip(ip, 64), clip(userAgent, 400))));
        if (!rows.isEmpty()) versions.accept(rows);
    }
    /** Like accept, only for the versions this account has not accepted yet (a returning Google or Facebook sign-in). */
    @Transactional
    public void acceptMissing(List<String> kinds, String context, UUID accountId, String ip, String userAgent) {
        var rows = new ArrayList<Acceptance>();
        for (String kind : kinds) versions.latest(kind).filter(v -> !versions.accepted(accountId, v.id()))
            .ifPresent(v -> rows.add(new Acceptance(v.id(), context, null, accountId, clip(ip, 64), clip(userAgent, 400))));
        if (!rows.isEmpty()) versions.accept(rows);
    }
    public List<Map<String, Object>> acceptances(UUID accountId) { return versions.acceptances(accountId); }

    /** A PDF for the legal pages, stored under its name; the same name replaces it. */
    public void storeFile(String file, byte[] bytes) {
        if (file == null || !LegalPages.Document.FILE.matcher(file).matches()) throw new IllegalArgumentException("El documento debe ser un PDF con un nombre en minúsculas, sin espacios");
        if (bytes == null || bytes.length < 5 || !new String(bytes, 0, 5, java.nio.charset.StandardCharsets.US_ASCII).equals("%PDF-")) throw new IllegalArgumentException("El archivo no es un PDF");
        if (bytes.length > 15 * 1024 * 1024) throw new IllegalArgumentException("El PDF admite hasta 15 MB");
        files.put(FILES + file, bytes, "application/pdf");
    }
    /** A document attached to a published page (or, for the panel, to a draft); any other name is not found. */
    public ObjectStore.StoredObject file(String file, boolean drafts) {
        boolean attached = LegalPages.KINDS.stream().anyMatch(k -> versions.latest(k).map(v -> attaches(v.page(), file)).orElse(false))
            || drafts && LegalPages.KINDS.stream().anyMatch(k -> attaches(drafts().page(k).orElseThrow(), file));
        if (file == null || !attached) throw new NotFound("Ese documento no existe");
        return files.get(FILES + file);
    }

    public ErrorPages errorPages() { return ErrorPages.fromMap(settings.read(ErrorPages.KEY).orElse(null)); }
    @Transactional
    public ErrorPages.Page saveErrorPage(String kind, ErrorPages.Page page, UUID actor) {
        if (!ErrorPages.known(kind)) throw new NotFound("Esa página de error no existe");
        settings.write(ErrorPages.KEY, errorPages().with(kind, page).toMap(), actor);
        return page;
    }
    /** The page shoppers see, only while the store has it on. */
    public Optional<ErrorPages.Page> liveErrorPage(String kind) {
        return ErrorPages.known(kind) ? Optional.of(errorPages().page(kind)).filter(ErrorPages.Page::live) : Optional.empty();
    }

    private static boolean attaches(LegalPages.LegalPage page, String file) { return page.documents().stream().anyMatch(d -> d.file().equals(file)); }
    private void requireFiles(LegalPages.LegalPage page) {
        for (var document : page.documents()) {
            try { files.get(FILES + document.file()); }
            catch (NotFound e) { throw new IllegalArgumentException("Sube primero el archivo " + document.file()); }
        }
    }
    private static String clip(String value, int max) { String v = value == null ? "" : value.trim(); return v.length() > max ? v.substring(0, max) : v; }
}

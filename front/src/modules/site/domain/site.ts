// The panel's «Sitio» section: the store's legal documents (drafts and published versions) and its own error pages.
import type { LegalKind, LegalPage } from "../../shared/domain/legal"
import type { ErrorPage, ErrorPageKind } from "../../shared/domain/error-page"

export type Published = { version: number; title: string; publishedAt: string }
/** One legal page: what the panel edits (draft), what shoppers read (published) and whether they differ. */
export type LegalOverview = { kind: LegalKind; draft: LegalPage; published: Published | null; changed: boolean; history: Published[] }
export type StoredErrorPage = ErrorPage & { enabled: boolean }
export type ErrorPages = Record<ErrorPageKind, StoredErrorPage>

export const isEmpty = (page: LegalPage) => page.blocks.length === 0 && page.documents.length === 0

/** A PDF name the store keeps: lowercase, no spaces, ends in .pdf (mirrors LegalPages.Document.FILE in the backend). */
export function pdfName(original: string): string {
  const base = original.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\.pdf$/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70)
  return `${base || "documento"}.pdf`
}

/** What a new error page starts with: the store's own classes, so it looks like the store from the first save. */
export const ERROR_PAGE_EXAMPLE: Record<ErrorPageKind, ErrorPage> = {
  not_found: {
    html: `<section class="store-missing-body">
  <p class="eyebrow">Error 404</p>
  <h1>No encontramos esta página</h1>
  <p>Puede que el enlace haya cambiado. El catálogo completo sigue a un paso.</p>
  <div class="store-missing-actions">
    <a class="button-primary" href="/productos">Ver todos los productos</a>
    <a class="link-arrow" id="whatsapp" target="_blank" rel="noopener">Escríbenos por WhatsApp</a>
  </div>
</section>`,
    css: `h1 { color: var(--brand-pink-strong); }`,
    js: `const link = document.getElementById("whatsapp");
const url = tienda.whatsapp("Hola, buscaba " + tienda.ruta + " y no lo encontré");
if (url) link.href = url; else link.remove();`,
  },
  error: {
    html: `<section class="store-missing-body">
  <p class="eyebrow">Algo salió mal</p>
  <h1>No pudimos cargar esta página</h1>
  <p>Fue un problema nuestro. Vuelve a intentarlo en un momento.</p>
  <div class="store-missing-actions">
    <button class="button-primary" type="button" id="retry">Reintentar</button>
    <a class="link-arrow" href="/">Ir al inicio</a>
  </div>
</section>`,
    css: ``,
    js: `document.getElementById("retry").addEventListener("click", () => tienda.reintentar());`,
  },
}

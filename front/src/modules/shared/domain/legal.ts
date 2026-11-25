// The store's legal pages, as the backend keeps them (settings 'legal'). Plain text in blocks, never HTML.

export type LegalKind = "terms" | "privacy" | "returns" | "shipping"
export const LEGAL_KINDS: LegalKind[] = ["terms", "privacy", "returns", "shipping"]
export type LegalBlock =
  | { kind: "heading" | "subheading" | "paragraph"; text: string }
  | { kind: "list"; items: string[] }
export type LegalDocument = { title: string; file: string }
export type LegalPage = { title: string; blocks: LegalBlock[]; documents: LegalDocument[] }
/** A published page: the version a shopper reads and accepts. */
export type PublishedLegalPage = LegalPage & { version: number; publishedAt: string }

/** Where each page lives in the store; the same addresses the old WordPress site used. */
export const LEGAL_PATHS: Record<LegalKind, string> = {
  terms: "/terminos-y-condiciones-de-uso",
  privacy: "/politica-de-tratamiento-de-datos",
  returns: "/politica-de-cambios-devoluciones-y-reembolsos",
  shipping: "/politica-de-envios",
}
/** How each page is named in links and in the panel. */
export const LEGAL_LABELS: Record<LegalKind, string> = {
  terms: "Términos y condiciones",
  privacy: "Política de tratamiento de datos",
  returns: "Política de cambios, devoluciones y reembolsos",
  shipping: "Política de envíos",
}

/** The address of a document a legal page attaches, served by the store itself. */
export const legalDocumentHref = (file: string) => `/api/documentos-legales/${encodeURIComponent(file)}`

/** An anchor for a heading: "Términos de venta y Capacidad" -> "terminos-de-venta-y-capacidad". */
export const legalAnchor = (text: string) =>
  text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60)

import type { LegalKind, PublishedLegalPage } from "../domain/legal"
import type { ErrorPage, ErrorPageKind } from "../domain/error-page"

/** The legal pages the store publishes, in their latest version; null when it has not published that page. */
export interface LegalPort {
  load(kind: LegalKind): Promise<PublishedLegalPage | null>
}
/** The store's own error pages; null while the store shows the built-in one. */
export interface ErrorPagesPort {
  load(kind: ErrorPageKind): Promise<ErrorPage | null>
}

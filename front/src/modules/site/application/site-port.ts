import type { LegalKind, LegalPage } from "../../shared/domain/legal"
import type { ErrorPageKind } from "../../shared/domain/error-page"
import type { ErrorPages, LegalOverview, StoredErrorPage } from "../domain/site"

export interface SitePort {
  legal(): Promise<LegalOverview[]>
  saveDraft(kind: LegalKind, page: LegalPage, csrf: string): Promise<LegalOverview[]>
  /** A first draft from the store's real rules; only over an empty page. */
  generateDraft(kind: LegalKind, csrf: string): Promise<LegalOverview[]>
  publish(kind: LegalKind, csrf: string): Promise<LegalOverview[]>
  /** Stores a PDF under that name (replacing one with the same name); attach it by saving the draft. */
  uploadPdf(name: string, file: Blob, csrf: string): Promise<string>
  /** Where the panel opens an attached PDF. */
  pdfHref(file: string): string
  errorPages(): Promise<ErrorPages>
  saveErrorPage(kind: ErrorPageKind, page: StoredErrorPage, csrf: string): Promise<ErrorPages>
}

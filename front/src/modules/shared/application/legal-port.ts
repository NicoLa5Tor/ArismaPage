import type { LegalKind, LegalPage } from "../domain/legal"

/** The legal pages the store publishes; null when it has not written that page. */
export interface LegalPort {
  load(kind: LegalKind): Promise<LegalPage | null>
}

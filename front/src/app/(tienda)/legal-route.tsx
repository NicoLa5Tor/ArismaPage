import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { httpLegal } from "../../modules/shared/adapters/http-legal"
import { httpStoreProfile } from "../../modules/shared/adapters/http-store-profile"
import { LEGAL_LABELS, LEGAL_PATHS, type LegalKind } from "../../modules/shared/domain/legal"
import { legalHref, robotsFor } from "../../modules/shared/domain/store-profile"
import { LegalView } from "../../modules/storefront/ui/legal/legal-view"

/** Title, description and canonical address of a legal page, as the store published it. */
export async function legalMetadata(kind: LegalKind): Promise<Metadata> {
  const [page, profile] = await Promise.all([httpLegal.load(kind), httpStoreProfile.load()])
  const title = page?.title || LEGAL_LABELS[kind]
  return { title, description: `${title} de ${profile.legalName || profile.name}, tal como la publica la tienda.`, robots: robotsFor(profile, { index: true, follow: true }), alternates: { canonical: LEGAL_PATHS[kind] } }
}

/** The store's own page in its latest published version; otherwise the address its profile gives, or a 404. */
export async function LegalRoute({ kind }: { kind: LegalKind }) {
  const [page, profile] = await Promise.all([httpLegal.load(kind), httpStoreProfile.load()])
  if (!page) {
    const elsewhere = legalHref({ ...profile, legal: { ...profile.legal, [kind]: false } }, kind)
    if (elsewhere) redirect(elsewhere)
    notFound()
  }
  return <LegalView kind={kind} page={page} profile={profile} />
}

import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { httpLegal } from "../../../modules/shared/adapters/http-legal"
import { httpStoreProfile } from "../../../modules/shared/adapters/http-store-profile"
import { LEGAL_PATHS } from "../../../modules/shared/domain/legal"
import { LegalView } from "../../../modules/storefront/ui/legal/legal-view"

export async function generateMetadata(): Promise<Metadata> {
  const [page, profile] = await Promise.all([httpLegal.load("privacy"), httpStoreProfile.load()])
  const title = page?.title || "Política de tratamiento de datos"
  return { title, description: `${title} de ${profile.legalName || profile.name}, tal como la publica la tienda.`, robots: { index: true, follow: true }, alternates: { canonical: LEGAL_PATHS.privacy } }
}

/** The store's own page when it wrote one in the panel; otherwise the address its profile gives, or a 404. */
export default async function PrivacyPage() {
  const [page, profile] = await Promise.all([httpLegal.load("privacy"), httpStoreProfile.load()])
  if (!page) {
    const elsewhere = profile.privacyUrl
    if (elsewhere) redirect(elsewhere)
    notFound()
  }
  return <LegalView kind="privacy" page={page} profile={profile} />
}

import type { Metadata } from "next"
import { CheckoutView } from "../../../modules/checkout/ui/checkout-view"
import { httpStoreProfile } from "../../../modules/shared/adapters/http-store-profile"
import { legalHref, whatsappLink } from "../../../modules/shared/domain/store-profile"
import { LEGAL_KINDS, LEGAL_LABELS } from "../../../modules/shared/domain/legal"
import { StoreHeader } from "../../../modules/storefront/ui/store-header"

export const metadata: Metadata = { title: "Finalizar compra", robots: { index: false, follow: false } }

export default async function CheckoutPage() {
  const profile = await httpStoreProfile.load()
  return <main id="contenido" className="storefront catalog checkout-page"><StoreHeader /><CheckoutView legal={LEGAL_KINDS.flatMap((kind) => { const href = legalHref(profile, kind); return href ? [{ label: LEGAL_LABELS[kind], href }] : [] })} cancels={profile.shopperCancels} whatsapp={whatsappLink(profile, "Hola, quiero terminar una compra de la página")} /></main>
}

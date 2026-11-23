import type { Metadata } from "next"
import { CheckoutView } from "../../../modules/checkout/ui/checkout-view"
import { httpStoreProfile } from "../../../modules/shared/adapters/http-store-profile"
import { legalHref, whatsappLink } from "../../../modules/shared/domain/store-profile"
import { StoreHeader } from "../../../modules/storefront/ui/store-header"

export const metadata: Metadata = { title: "Finalizar compra", robots: { index: false, follow: false } }

export default async function CheckoutPage() {
  const profile = await httpStoreProfile.load()
  return <main id="contenido" className="storefront catalog checkout-page"><StoreHeader /><CheckoutView terms={legalHref(profile, "terms") ?? ""} privacy={legalHref(profile, "privacy") ?? ""} whatsapp={whatsappLink(profile, "Hola, quiero terminar una compra de la página")} /></main>
}

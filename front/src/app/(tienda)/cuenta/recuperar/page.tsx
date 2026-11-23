import type { Metadata } from "next"
import { ResetRequest } from "../../../../modules/account/ui/account-links"
import { StoreHeader } from "../../../../modules/storefront/ui/store-header"

export const metadata: Metadata = { title: "Recupera tu cuenta", robots: { index: false, follow: true } }

export default function ResetRequestPage() {
  return <main id="contenido" className="storefront catalog account-page"><StoreHeader /><div className="account-stage"><ResetRequest /></div></main>
}

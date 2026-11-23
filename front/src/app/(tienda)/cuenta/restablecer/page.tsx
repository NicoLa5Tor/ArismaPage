import type { Metadata } from "next"
import { ResetPassword } from "../../../../modules/account/ui/account-links"
import { StoreHeader } from "../../../../modules/storefront/ui/store-header"

// The address carries a one-time token: never indexed, never sent as a referrer.
export const metadata: Metadata = { title: "Elige una contraseña nueva", robots: { index: false, follow: false }, referrer: "no-referrer" }

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const { token } = await searchParams
  return <main id="contenido" className="storefront catalog account-page"><StoreHeader /><div className="account-stage"><ResetPassword token={(Array.isArray(token) ? token[0] : token) ?? ""} /></div></main>
}

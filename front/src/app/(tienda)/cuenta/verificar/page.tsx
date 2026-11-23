import type { Metadata } from "next"
import { VerifyEmail } from "../../../../modules/account/ui/account-links"
import { StoreHeader } from "../../../../modules/storefront/ui/store-header"

export const metadata: Metadata = { title: "Confirma tu correo", robots: { index: false, follow: false }, referrer: "no-referrer" }

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const { token } = await searchParams
  return <main id="contenido" className="storefront catalog account-page"><StoreHeader /><div className="account-stage"><VerifyEmail token={(Array.isArray(token) ? token[0] : token) ?? ""} /></div></main>
}

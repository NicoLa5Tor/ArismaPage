import type { Metadata } from "next"
import { OwnedOrder } from "../../../../../modules/checkout/ui/owned-order"
import { httpStoreProfile } from "../../../../../modules/shared/adapters/http-store-profile"
import { whatsappLink } from "../../../../../modules/shared/domain/store-profile"
import { StoreHeader } from "../../../../../modules/storefront/ui/store-header"

export const metadata: Metadata = { title: "Tu pedido", robots: { index: false, follow: false }, referrer: "no-referrer" }

type Props = { params: Promise<{ numero: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }

export default async function AccountOrderPage({ params, searchParams }: Props) {
  const { numero } = await params
  const query = await searchParams
  const profile = await httpStoreProfile.load()
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? ""
  // whatever the gateway appended when it sent the shopper back; the store verifies it
  const returned: Record<string, string> = {}
  for (const [name, value] of Object.entries(query)) if (first(value).length <= 300 && Object.keys(returned).length < 60) returned[name] = first(value)
  return (
    <main id="contenido" className="storefront catalog order-page">
      <StoreHeader />
      <OwnedOrder number={numero} returned={returned} whatsapp={whatsappLink(profile, `Hola, necesito ayuda con mi pedido #${numero}`)} />
    </main>
  )
}

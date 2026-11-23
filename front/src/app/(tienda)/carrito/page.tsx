import type { Metadata } from "next"
import { CartView } from "../../../modules/checkout/ui/cart-view"
import { StoreHeader } from "../../../modules/storefront/ui/store-header"

export const metadata: Metadata = { title: "Tu carrito", robots: { index: false, follow: true } }

export default function CartPage() {
  return <main id="contenido" className="storefront catalog cart-page"><StoreHeader /><CartView /></main>
}

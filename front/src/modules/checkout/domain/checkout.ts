// Checkout: the cart as the store prices it, who buys, how it is delivered and how it is paid.

import type { TrackingEvent, TrackingStage } from "../../shared/domain/carriers"
import { isLocal, type StoreProfile } from "../../shared/domain/store-profile"
export type Delivery = "local" | "national" | "pickup"
export type QuoteLine = {
  productId: string; slug: string; title: string; quantity: number; maxQuantity: number
  /** Tax-inclusive unit price and line total before the coupon; discount is what the coupon takes from the line. */
  unitPrice: number | null; total: number; discount: number
  imageId: string | null; imageUrl: string | null; imageUploaded: boolean
  /** Why this line cannot be bought as asked, in words for the shopper. */
  problem: string | null
}
/** goods is the products before the coupon and discount what the coupon takes; shipping is null until a delivery is chosen. */
export type PricedCart = { lines: QuoteLine[]; goods: number; discount: number; coupon: string | null; tax: number; shipping: number | null; total: number; blockers: string[] }
/** couponError says why the code given does not apply; the cart is then priced without it. */
export type Quote = { cart: PricedCart; couponError: string | null; freeShippingCoupon: boolean }
export type ShippingRules = { localRate: number; nationalRate: number; freeFromLocal: number | null; pickup: boolean; minimumOrder: number }
/** The one method the store takes payments with; test means nothing is charged for real. */
export type PaymentMethod = { code: "wompi" | "payu" | "manual"; label: string; test: boolean }
/** payment is null while the store has no method ready. */
export type Options = { shipping: ShippingRules; payment: PaymentMethod | null }

export type Buyer = {
  firstName: string; lastName: string; email: string; phone: string; documentType: string; documentNumber: string; company: string
  pickup: boolean; address: string; addressDetail: string; city: string; state: string; note: string
}
export const emptyBuyer: Buyer = { firstName: "", lastName: "", email: "", phone: "", documentType: "CC", documentNumber: "", company: "", pickup: false, address: "", addressDetail: "", city: "", state: "", note: "" }

export type Placed = { number: string; key: string; total: number; test: boolean }
/** The buyer's own data sent with the order (it is also kept on their account). */
export type Contact = { firstName: string; lastName: string; phone: string; documentType: string; documentNumber: string; company: string }
/** An order from a signed-in buyer: one of their saved addresses, or pickup at the store. */
export type AccountOrder = { contact: Contact; pickup: boolean; addressId: string | null; note: string }
/** How the browser continues to the payment: go to a page, post a form, or read the store's instructions. */
export type Instruction = { kind: "redirect" | "form" | "manual"; url: string | null; fields: Record<string, string>; instructions: string | null }
export type PaymentOutcome = { status: "started" | "pending" | "approved" | "declined" | "voided" | "error"; message: string }

export type OrderView = {
  number: string; status: string; stage: string; test: boolean; subtotal: number; discount: number; coupon: string | null; shippingTotal: number; taxTotal: number; total: number
  paymentMethod: string | null; paymentMethodTitle: string | null; placedAt: string; paidAt: string | null; expiresAt: string | null
  firstName: string | null; email: string | null; city: string | null; address: string | null; deliveryMethod: string | null; shippingLabel: string | null
  trackingCode: string | null; carrier: string | null
  /** Set once the store sent the invoice: it downloads from /factura/<token>. */
  invoiceToken?: string | null
  /** The carrier's movements when the store follows the guide automatically; null otherwise. */
  tracking: { stage: TrackingStage | null; checkedAt: string | null; events: TrackingEvent[] } | null
  lines: { title: string; quantity: number; total: number; slug: string | null; productId: string | null; imageId: string | null; imageUrl: string | null; imageUploaded: boolean }[]
  /** payWith names the method a pending order can be paid with now; instructions are for a transfer. */
  canPay: boolean; payWith: string; instructions: string
}
/** An order in "Mis pedidos". */
export type OwnedOrder = {
  number: string; status: string; test: boolean; total: number; placedAt: string; paymentMethodTitle: string | null; stage: string; lines: number
  firstTitle: string | null; productId: string | null; imageId: string | null; imageUrl: string | null; imageUploaded: boolean | null
}
export const orderImageSrc = (order: Pick<OwnedOrder, "productId" | "imageId" | "imageUrl" | "imageUploaded">) =>
  quoteImageSrc({ productId: order.productId ?? "", imageId: order.imageId, imageUrl: order.imageUrl, imageUploaded: Boolean(order.imageUploaded) })

export { departments, departmentName, documentTypes } from "../../shared/domain/colombia"

/** Which rate applies: the same rule the store uses when it places the order. */
export function deliveryOf(buyer: Pick<Buyer, "pickup" | "city" | "state">, profile: Pick<StoreProfile, "localCity" | "localState">): Delivery | null {
  if (buyer.pickup) return "pickup"
  if (!buyer.state) return null
  return isLocal(profile, buyer.city, buyer.state) ? "local" : "national"
}

export type BuyerErrors = Partial<Record<keyof Buyer, string>>
const EMAIL = /^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]{2,}$/

export function buyerErrors(buyer: Buyer): BuyerErrors {
  const errors: BuyerErrors = {}
  if (buyer.firstName.trim().length < 2) errors.firstName = "Escribe tu nombre"
  if (buyer.lastName.trim().length < 2) errors.lastName = "Escribe tu apellido"
  if (!EMAIL.test(buyer.email.trim())) errors.email = "Escribe un correo válido"
  if (buyer.phone.replace(/\D/g, "").length < 7) errors.phone = "Escribe un teléfono de contacto"
  if (buyer.documentNumber.replace(/[^0-9A-Za-z]/g, "").length < 5) errors.documentNumber = "Escribe el número de documento"
  if (!buyer.pickup) {
    if (buyer.address.trim().length < 5) errors.address = "Escribe la dirección de entrega"
    if (buyer.city.trim().length < 2) errors.city = "Escribe la ciudad"
    if (!buyer.state) errors.state = "Elige el departamento"
  }
  return errors
}

export function quoteImageSrc(line: Pick<QuoteLine, "productId" | "imageId" | "imageUrl" | "imageUploaded">): string | null {
  if (line.imageUrl && !line.imageUploaded) return line.imageUrl
  if (line.imageId && line.productId) return `/api/arisma-public/products/${encodeURIComponent(line.productId)}/images/${encodeURIComponent(line.imageId)}`
  return line.imageUrl
}

/** The order's journey in the shopper's words. */
export const stageLabels: Record<string, { label: string; text: string; tone: "warn" | "good" | "bad" | "info" }> = {
  unpaid: { label: "Esperando el pago", text: "Tu pedido está guardado. Lo despachamos cuando recibamos el pago.", tone: "warn" },
  to_prepare: { label: "Pago recibido", text: "Estamos alistando tu pedido.", tone: "good" },
  packed: { label: "Empacado", text: "Tu pedido está listo para salir.", tone: "good" },
  shipped: { label: "En camino", text: "Tu pedido ya va hacia ti.", tone: "info" },
  delivered: { label: "Entregado", text: "Gracias por tu compra.", tone: "good" },
  issue: { label: "En revisión", text: "Estamos revisando tu pedido. Te escribimos pronto.", tone: "warn" },
  cancelled: { label: "Cancelado", text: "Este pedido se canceló. Si pagaste, escríbenos por WhatsApp.", tone: "bad" },
}

const cop = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 })
export const money = (value: number) => cop.format(value)

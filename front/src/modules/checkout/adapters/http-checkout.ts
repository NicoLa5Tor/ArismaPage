import type { CheckoutPort, OrderAccess } from "../application/checkout-port"
import type { CancelPreview, Instruction, Options, OrderNews, OrderView, OwnedOrder, PaymentOutcome, Placed, Quote } from "../domain/checkout"
import { storeJson, storeRequest } from "../../shared/adapters/store-client"

const own = (access: Extract<OrderAccess, { kind: "account" }>) => `/shop/orders/${encodeURIComponent(access.number)}`

export const httpCheckout: CheckoutPort = {
  options: () => storeRequest<Options>("/public/checkout/options"),
  quote: (lines, delivery, coupon, email) => storeRequest<Quote>("/public/checkout/quote", storeJson("POST", { lines, delivery: delivery ?? "", coupon: coupon ?? "", email: email ?? "" })),
  place: (lines, order, coupon) => storeRequest<Placed>("/public/checkout/orders", storeJson("POST", { lines, ...order, coupon: coupon ?? "", acceptsTerms: true })),
  order: (access) => access.kind === "key"
    ? storeRequest<OrderView>(`/public/orders/${encodeURIComponent(access.number)}?clave=${encodeURIComponent(access.key)}`)
    : storeRequest<OrderView>(own(access)),
  startPayment: (access) => access.kind === "key"
    ? storeRequest<Instruction>("/public/payments/start", storeJson("POST", { number: access.number, key: access.key }))
    : storeRequest<Instruction>(`${own(access)}/pay`, { method: "POST", headers: { "X-CSRF-Token": access.csrf } }),
  confirmReturn: (access, params) => access.kind === "key"
    ? storeRequest<PaymentOutcome>("/public/payments/return", storeJson("POST", { number: access.number, key: access.key, params }))
    : storeRequest<PaymentOutcome>(`${own(access)}/return`, storeJson("POST", { params }, access.csrf)),
  myOrders: () => storeRequest<OwnedOrder[]>("/shop/orders"),
  liveUrl: (access) => access.kind === "key"
    ? `/api/arisma-store/public/orders/${encodeURIComponent(access.number)}/events?clave=${encodeURIComponent(access.key)}`
    : `/api/arisma-store${own(access)}/events`,
  markSeen: async (access) => { if (access.kind === "account") await storeRequest<void>(`${own(access)}/seen`, { method: "POST", headers: { "X-CSRF-Token": access.csrf } }) },
  news: () => storeRequest<OrderNews[]>("/shop/orders/news"),
  cancelPreview: (access) => access.kind === "account"
    ? storeRequest<CancelPreview>(`${own(access)}/cancel`)
    : Promise.reject(new Error("Entra a tu cuenta para cancelar el pedido.")),
  cancelOrder: (access, reason, account) => access.kind === "account"
    ? storeRequest<OrderView>(`${own(access)}/cancel`, storeJson("POST", { reason, account }, access.csrf))
    : Promise.reject(new Error("Entra a tu cuenta para cancelar el pedido.")),
  giveRefundAccount: (access, account) => access.kind === "account"
    ? storeRequest<OrderView>(`${own(access)}/refund-account`, storeJson("POST", account, access.csrf))
    : Promise.reject(new Error("Entra a tu cuenta para darnos tu cuenta.")),
  newsUrl: () => "/api/arisma-store/shop/orders/news/events",
}

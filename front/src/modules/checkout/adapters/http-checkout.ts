import type { CheckoutPort, OrderAccess } from "../application/checkout-port"
import type { Instruction, Options, OrderView, OwnedOrder, PaymentOutcome, Placed, Quote } from "../domain/checkout"
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
}

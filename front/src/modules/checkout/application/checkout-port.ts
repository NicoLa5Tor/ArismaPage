import type { AccountOrder, Delivery, Instruction, Options, OrderView, OwnedOrder, PaymentOutcome, Placed, Quote } from "../domain/checkout"

export type CartRequest = { productId: string; quantity: number }[]
/** How an order is reached: with the key the shopper got when buying, or from their signed-in account. */
export type OrderAccess = { kind: "key"; number: string; key: string } | { kind: "account"; number: string; csrf: string }

/** Everything between the cart and a paid order. Prices always come from the store, never from the browser. */
export interface CheckoutPort {
  options(): Promise<Options>
  /** email lets the store check a coupon's limit per customer. */
  quote(lines: CartRequest, delivery: Delivery | null, coupon?: string, email?: string): Promise<Quote>
  /** Needs the store session (the cookie names the buyer). */
  place(lines: CartRequest, order: AccountOrder, coupon?: string): Promise<Placed>
  order(access: OrderAccess): Promise<OrderView>
  /** Starts a payment with the store's active method. */
  startPayment(access: OrderAccess): Promise<Instruction>
  /** Reports what the gateway put in the address when it sent the shopper back. */
  confirmReturn(access: OrderAccess, params: Record<string, string>): Promise<PaymentOutcome>
  /** The signed-in shopper's orders, newest first. */
  myOrders(): Promise<OwnedOrder[]>
}

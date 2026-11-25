import type { AccountOrder, Delivery, Instruction, Options, OrderView, OwnedOrder, PaymentOutcome, Placed, Quote, OrderNews, CancelPreview } from "../domain/checkout"
import type { RefundAccount } from "../domain/refund-account"

export type CartRequest = { productId: string; quantity: number }[]
/** How an order is reached: with the key the shopper got when buying, or from their signed-in account. */
export type OrderAccess = { kind: "key"; number: string; key: string } | { kind: "account"; number: string; csrf: string }

/** Everything between the cart and a paid order. Prices always come from the store, never from the browser. */
export interface CheckoutPort {
  options(): Promise<Options>
  /** email lets the store check a coupon's limit per customer. */
  quote(lines: CartRequest, delivery: Delivery | null, coupon?: string, email?: string): Promise<Quote>
  /** Needs the store session (the cookie names the buyer). */
  /** acceptsTerms: the buyer ticked the box; the store records which version of each policy they accepted. */
  place(lines: CartRequest, order: AccountOrder, coupon: string | undefined, acceptsTerms: boolean): Promise<Placed>
  order(access: OrderAccess): Promise<OrderView>
  /** Starts a payment with the store's active method. */
  startPayment(access: OrderAccess): Promise<Instruction>
  /** Reports what the gateway put in the address when it sent the shopper back. */
  confirmReturn(access: OrderAccess, params: Record<string, string>): Promise<PaymentOutcome>
  /** The signed-in shopper's orders, newest first. */
  myOrders(): Promise<OwnedOrder[]>
  /** Server-Sent Events address that tells this order's page when it changed (paid, sent, tracked). */
  liveUrl(access: OrderAccess): string
  /** The shopper opened their order: its steps so far stop being news. Only for orders of the account. */
  markSeen(access: OrderAccess): Promise<void>
  /** What cancelling would do now (only for orders of the account). */
  cancelPreview(access: OrderAccess): Promise<CancelPreview>
  /** Cancels the order; `account` is required when the money goes back by transfer. */
  cancelOrder(access: OrderAccess, reason: string, account: RefundAccount | null): Promise<OrderView>
  /** The account for a refund the gateway could not give back. */
  giveRefundAccount(access: OrderAccess, account: RefundAccount): Promise<OrderView>
  /** Orders of the account with a step not seen yet. */
  news(): Promise<OrderNews[]>
  /** Server-Sent Events: something changed in one of the account's orders. */
  newsUrl(): string
}

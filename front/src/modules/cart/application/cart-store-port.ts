import type { CartLine } from "../domain/cart"

/** Where the cart lives between visits. `read` answers the same array until the cart changes, so the UI can subscribe to it. */
export interface CartStorePort {
  read(): CartLine[]
  write(lines: CartLine[]): void
  /** Calls back when the cart changes, here or in another tab. Returns how to stop listening. */
  subscribe(listener: () => void): () => void
  /** The coupon code the shopper typed, kept with the cart until the order is placed. "" when none. */
  readCoupon(): string
  writeCoupon(code: string): void
}

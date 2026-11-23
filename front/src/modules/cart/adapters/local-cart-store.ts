import type { CartStorePort } from "../application/cart-store-port"
import { type CartLine, parseCart } from "../domain/cart"

const KEY = "arisma.carrito.v1"
const COUPON = "arisma.cupon.v1"
let memoryCoupon = ""
const EMPTY: CartLine[] = []
const listeners = new Set<() => void>()
let cachedRaw: string | null | undefined
let cachedLines: CartLine[] = EMPTY

// Private browsing and blocked storage throw on access: the cart then lives in memory for the visit.
function stored(): string | null {
  try { return window.localStorage.getItem(KEY) } catch { return cachedRaw ?? null }
}

/** Browser cart in localStorage, shared between tabs through the `storage` event. */
export const localCartStore: CartStorePort = {
  read() {
    if (typeof window === "undefined") return EMPTY
    const raw = stored()
    if (raw !== cachedRaw) {
      cachedRaw = raw
      try { cachedLines = raw ? parseCart(JSON.parse(raw)) : EMPTY } catch { cachedLines = EMPTY }
    }
    return cachedLines
  },
  write(lines) {
    const raw = JSON.stringify(lines)
    cachedRaw = raw
    cachedLines = lines
    try { window.localStorage.setItem(KEY, raw) } catch { /* kept in memory */ }
    listeners.forEach((listener) => listener())
  },
  readCoupon() {
    if (typeof window === "undefined") return ""
    try { return (window.localStorage.getItem(COUPON) ?? "").slice(0, 40) } catch { return memoryCoupon }
  },
  writeCoupon(code) {
    memoryCoupon = code.trim().slice(0, 40)
    try { if (memoryCoupon) window.localStorage.setItem(COUPON, memoryCoupon); else window.localStorage.removeItem(COUPON) } catch { /* kept in memory */ }
    listeners.forEach((listener) => listener())
  },
  subscribe(listener) {
    listeners.add(listener)
    const onStorage = (event: StorageEvent) => { if (event.key === KEY || event.key === COUPON || event.key === null) listener() }
    window.addEventListener("storage", onStorage)
    return () => { listeners.delete(listener); window.removeEventListener("storage", onStorage) }
  },
}

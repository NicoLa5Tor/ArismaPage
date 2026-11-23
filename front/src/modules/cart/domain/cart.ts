// The shopper's cart, as kept in the browser. Prices here are only what the shopper last saw: the store always
// prices the cart again on the server before anything is charged.

export type CartLine = {
  productId: string
  slug: string
  title: string
  /** Tax-inclusive unit price shown when the product was added. */
  unitPrice: number
  image: string | null
  quantity: number
  /** Most units one order may carry (stock, or one when the product is sold individually). */
  maxQuantity: number
}

export type CartItem = Omit<CartLine, "quantity">

export const MAX_LINES = 40
export const MAX_PER_LINE = 99

const clampQuantity = (quantity: number, max: number) => Math.min(Math.max(Math.trunc(quantity) || 1, 1), Math.max(1, Math.min(max, MAX_PER_LINE)))

/** Adds units of a product; an existing line grows up to its limit. `added` is how many units really went in. */
export function addToCart(lines: CartLine[], item: CartItem, quantity = 1): { lines: CartLine[]; added: number; full: boolean } {
  const existing = lines.find((line) => line.productId === item.productId)
  if (existing) {
    const next = clampQuantity(existing.quantity + quantity, item.maxQuantity)
    return { lines: lines.map((line) => (line === existing ? { ...item, quantity: next } : line)), added: next - existing.quantity, full: false }
  }
  if (lines.length >= MAX_LINES) return { lines, added: 0, full: true }
  const next = clampQuantity(quantity, item.maxQuantity)
  return { lines: [...lines, { ...item, quantity: next }], added: next, full: false }
}

export function setQuantity(lines: CartLine[], productId: string, quantity: number): CartLine[] {
  if (quantity <= 0) return removeFromCart(lines, productId)
  return lines.map((line) => (line.productId === productId ? { ...line, quantity: clampQuantity(quantity, line.maxQuantity) } : line))
}

export const removeFromCart = (lines: CartLine[], productId: string): CartLine[] => lines.filter((line) => line.productId !== productId)

export const itemCount = (lines: CartLine[]): number => lines.reduce((total, line) => total + line.quantity, 0)

export const subtotal = (lines: CartLine[]): number => lines.reduce((total, line) => total + line.unitPrice * line.quantity, 0)

const isText = (value: unknown, max: number): value is string => typeof value === "string" && value.length > 0 && value.length <= max

/** Reads whatever the browser stored. Anything that is not a well-formed line is dropped, so a stale or edited value never breaks the store. */
export function parseCart(raw: unknown): CartLine[] {
  if (!Array.isArray(raw)) return []
  const lines: CartLine[] = []
  const seen = new Set<string>()
  for (const entry of raw.slice(0, MAX_LINES)) {
    if (!entry || typeof entry !== "object") continue
    const { productId, slug, title, unitPrice, image, quantity, maxQuantity } = entry as Record<string, unknown>
    if (!isText(productId, 64) || !isText(slug, 240) || !isText(title, 300) || seen.has(productId)) continue
    if (typeof unitPrice !== "number" || !Number.isFinite(unitPrice) || unitPrice < 0) continue
    const max = typeof maxQuantity === "number" && maxQuantity >= 1 ? Math.min(Math.trunc(maxQuantity), MAX_PER_LINE) : MAX_PER_LINE
    seen.add(productId)
    lines.push({ productId, slug, title, unitPrice, image: isText(image, 600) ? image : null, quantity: clampQuantity(typeof quantity === "number" ? quantity : 1, max), maxQuantity: max })
  }
  return lines
}

const cop = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 })
export const formatMoney = (value: number) => cop.format(value)

"use client"

import { useEffect, useMemo, useState } from "react"
import { useCart } from "../../cart/ui/cart-context"
import { usePort } from "../../shared/ui/ports"
import type { CartRequest, CheckoutPort } from "../application/checkout-port"
import type { Delivery, Quote } from "../domain/checkout"

/**
 * The cart as the store prices it right now, asked again whenever the products, the coupon, the delivery or the
 * email change (debounced). The browser's own prices are never used for totals.
 */
export function useQuote(delivery: Delivery | null, email = "") {
  const port = usePort<CheckoutPort>("checkout")
  const cart = useCart()
  const [quote, setQuote] = useState<Quote | null>(null)
  const [checking, setChecking] = useState(false)
  const [failed, setFailed] = useState(false)
  const key = cart.lines.map((line) => `${line.productId}:${line.quantity}`).join(",")
  const lines: CartRequest = useMemo(() => (key ? key.split(",").map((pair) => { const [productId, quantity] = pair.split(":"); return { productId, quantity: Number(quantity) } }) : []), [key])
  const mail = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email.trim()) ? email.trim() : ""

  useEffect(() => {
    if (!cart.ready || lines.length === 0) { queueMicrotask(() => setQuote(null)); return }
    let active = true
    queueMicrotask(() => setChecking(true))
    const timer = window.setTimeout(() => {
      port.quote(lines, delivery, cart.coupon, mail)
        .then((found) => { if (active) { setQuote(found); setFailed(false) } })
        .catch(() => { if (active) setFailed(true) })
        .finally(() => { if (active) setChecking(false) })
    }, 250)
    return () => { active = false; window.clearTimeout(timer) }
  }, [port, cart.ready, lines, delivery, cart.coupon, mail])

  return { quote, checking, failed, lines }
}

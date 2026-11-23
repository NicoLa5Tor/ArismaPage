"use client"

import { ShoppingBag } from "@phosphor-icons/react"
import { useCart } from "./cart-context"

/** Opens the cart. The count only appears once the browser's cart has been read. */
export function CartButton({ className = "" }: { className?: string }) {
  const { count, ready, setOpen } = useCart()
  const shown = ready ? count : 0
  return (
    <button type="button" data-cart-button className={`cart-button squircle ${className}`} onClick={() => setOpen(true)} aria-haspopup="dialog"
      aria-label={shown === 0 ? "Abrir el carrito, está vacío" : `Abrir el carrito, ${shown} ${shown === 1 ? "producto" : "productos"}`}>
      <ShoppingBag size={20} weight="fill" aria-hidden="true" />
      <span className="cart-button-label">Carrito</span>
      {shown > 0 && <span className="cart-button-count" aria-hidden="true">{shown > 99 ? "99+" : shown}</span>}
    </button>
  )
}

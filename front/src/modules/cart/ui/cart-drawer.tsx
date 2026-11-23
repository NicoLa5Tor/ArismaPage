"use client"

import Link from "next/link"
import { useEffect, useRef } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { ArrowRight, ShoppingBag, X } from "@phosphor-icons/react"
import { formatMoney } from "../domain/cart"
import { useCart } from "./cart-context"
import { CartLines } from "./cart-lines"
import { useScrollLock } from "../../shared/ui/scroll-lock"

const ease = [0.22, 1, 0.36, 1] as const

/**
 * The cart as a side panel, reachable from every store page. It is a modal dialog: focus moves in and comes back to
 * whatever opened it, Escape and the backdrop close it, and the page behind does not scroll.
 */
export function CartDrawer() {
  const { open, setOpen, lines, count, subtotal } = useCart()
  const reduce = useReducedMotion()
  const panel = useRef<HTMLDivElement>(null)
  const opener = useRef<HTMLElement | null>(null)
  useScrollLock(open)

  useEffect(() => {
    if (!open) return
    opener.current = document.activeElement as HTMLElement | null
    panel.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); return }
      if (event.key !== "Tab" || !panel.current) return
      // keep Tab inside the panel while it is open
      const focusable = Array.from(panel.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), [tabindex]:not([tabindex='-1'])")).filter((el) => el.getClientRects().length > 0)
      if (focusable.length === 0) { event.preventDefault(); return }
      const first = focusable[0], last = focusable[focusable.length - 1]
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener("keydown", onKey)
    return () => { document.removeEventListener("keydown", onKey); opener.current?.focus?.() }
  }, [open, setOpen])

  const close = () => setOpen(false)
  return (
    <AnimatePresence>
      {open && (
        <div className="storefront cart-drawer-root" data-lenis-prevent>
          <motion.div className="cart-drawer-backdrop" onClick={close} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} />
          <motion.div ref={panel} className="cart-drawer" role="dialog" aria-modal="true" aria-labelledby="cart-drawer-title" tabIndex={-1}
            initial={reduce ? { opacity: 0 } : { x: "100%" }} animate={reduce ? { opacity: 1 } : { x: 0 }} exit={reduce ? { opacity: 0 } : { x: "100%" }} transition={{ duration: 0.45, ease }}>
            <header className="cart-drawer-head">
              <h2 id="cart-drawer-title">Tu carrito{count > 0 ? <span>{count} {count === 1 ? "producto" : "productos"}</span> : null}</h2>
              <button type="button" className="cart-drawer-close" onClick={close} aria-label="Cerrar el carrito"><X size={20} aria-hidden="true" /></button>
            </header>
            {lines.length === 0 ? (
              <div className="cart-empty">
                <span className="cart-empty-icon squircle" aria-hidden="true"><ShoppingBag size={32} weight="fill" /></span>
                <h3>Tu carrito está vacío</h3>
                <p>Agrega un juguete o un material y aquí verás el total antes de pagar.</p>
                <Link href="/productos" className="button-primary" onClick={close}>Ver productos <ArrowRight size={18} weight="bold" aria-hidden="true" /></Link>
              </div>
            ) : (
              <>
                <div className="cart-drawer-body"><CartLines onNavigate={close} /></div>
                <footer className="cart-drawer-foot">
                  <div className="cart-total"><span>Subtotal</span><strong>{formatMoney(subtotal)}</strong></div>
                  <p className="cart-note">IVA incluido. El envío se calcula en el siguiente paso.</p>
                  <Link href="/checkout" className="button-primary cart-checkout" onClick={close}>Finalizar compra <ArrowRight size={18} weight="bold" aria-hidden="true" /></Link>
                  <Link href="/carrito" className="cart-view" onClick={close}>Ver el carrito completo</Link>
                </footer>
              </>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

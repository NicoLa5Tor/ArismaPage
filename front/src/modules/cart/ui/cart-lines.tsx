"use client"

import Link from "next/link"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { ImageSquare, Trash } from "@phosphor-icons/react"
import { formatMoney } from "../domain/cart"
import { useCart } from "./cart-context"
import { Quantity } from "./quantity"
import { optimized } from "../../shared/ui/optimized-image"

const ease = [0.22, 1, 0.36, 1] as const

/** The products in the cart, each with its photo, quantity and line total. Used by the drawer and by the cart page. */
export function CartLines({ onNavigate }: { onNavigate?: () => void }) {
  const { lines, change, remove } = useCart()
  const reduce = useReducedMotion()
  return (
    <ul className="cart-lines">
      <AnimatePresence initial={false}>
        {lines.map((line) => (
          <motion.li key={line.productId} className="cart-line" layout={reduce ? false : "position"} initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, x: 24 }} transition={{ duration: 0.3, ease }}>
            <Link href={`/producto/${encodeURIComponent(line.slug)}`} className="cart-line-photo squircle" onClick={onNavigate} tabIndex={-1} aria-hidden="true">
              {line.image ? <img {...optimized(line.image, { sizes: "80px", width: 80 })} alt="" loading="lazy" decoding="async" /> : <ImageSquare size={24} />}
            </Link>
            <div className="cart-line-body">
              <Link href={`/producto/${encodeURIComponent(line.slug)}`} className="cart-line-title" onClick={onNavigate}>{line.title}</Link>
              <span className="cart-line-unit">{formatMoney(line.unitPrice)} c/u</span>
              <div className="cart-line-controls">
                <Quantity size="sm" value={line.quantity} max={line.maxQuantity} label={`Unidades de ${line.title}`} onChange={(quantity) => change(line.productId, quantity)} />
                <button type="button" className="cart-line-remove" onClick={() => remove(line.productId)} aria-label={`Quitar ${line.title} del carrito`}><Trash size={18} aria-hidden="true" /></button>
              </div>
            </div>
            <strong className="cart-line-total">{formatMoney(line.unitPrice * line.quantity)}</strong>
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  )
}

"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { ArrowRight, ShoppingBag, Truck, Warning } from "@phosphor-icons/react"
import { useCart } from "../../cart/ui/cart-context"
import { CartLines } from "../../cart/ui/cart-lines"
import { usePort } from "../../shared/ui/ports"
import type { CheckoutPort } from "../application/checkout-port"
import { type Options, money } from "../domain/checkout"
import { CouponField } from "./coupon-field"
import { useQuote } from "./use-quote"
import { localArea } from "../../shared/domain/store-profile"
import { useStoreProfile } from "../../shared/ui/store-profile"

/** The whole cart on its own page, checked against the store: current prices, coupon, what ran out and the minimum order. */
export function CartView() {
  const port = usePort<CheckoutPort>("checkout")
  const profile = useStoreProfile()
  const cart = useCart()
  const { quote, checking, failed } = useQuote(null)
  const [options, setOptions] = useState<Options | null>(null)
  useEffect(() => { port.options().then(setOptions).catch(() => setOptions(null)) }, [port])

  if (!cart.ready) return <div className="cart-page-body" aria-busy="true"><p className="store-wait">Cargando tu carrito…</p></div>
  if (cart.lines.length === 0) return (
    <div className="cart-page-body">
      <div className="cart-empty cart-empty-page">
        <span className="cart-empty-icon squircle" aria-hidden="true"><ShoppingBag size={32} weight="fill" /></span>
        <h1>Tu carrito está vacío</h1>
        <p>Recorre el catálogo o cuéntale al asistente qué buscas. Lo que agregues te espera aquí.</p>
        <Link href="/productos" className="button-primary">Ver productos <ArrowRight size={18} weight="bold" aria-hidden="true" /></Link>
      </div>
    </div>
  )

  const priced = quote?.cart
  const problems = priced?.lines.filter((line) => line.problem) ?? []
  const blocked = problems.length > 0 || (priced?.blockers.length ?? 0) > 0
  const payable = priced ? priced.goods - priced.discount : cart.subtotal
  const free = options?.shipping.freeFromLocal
  const missing = free && priced && payable < free && !quote?.freeShippingCoupon ? free - payable : 0
  return (
    <div className="cart-page-body">
      <h1>Tu carrito</h1>
      <div className="cart-page-grid">
        <div className="cart-page-lines">
          {problems.length > 0 && (
            <ul className="store-alert cart-problems" role="alert">
              {problems.map((line) => (
                <li key={line.productId}><Warning size={18} weight="fill" aria-hidden="true" /> <span><strong>{line.title}</strong>: {line.problem}.</span>
                  {line.maxQuantity > 0 && line.quantity > line.maxQuantity ? <button type="button" onClick={() => cart.change(line.productId, line.maxQuantity)}>Dejar {line.maxQuantity}</button> : <button type="button" onClick={() => cart.remove(line.productId)}>Quitar</button>}
                </li>
              ))}
            </ul>
          )}
          <CartLines />
        </div>
        <aside className="order-summary squircle" aria-label="Resumen de la compra" aria-busy={checking}>
          <h2>Resumen</h2>
          <dl>
            <div><dt>Productos</dt><dd>{money(priced?.goods ?? cart.subtotal)}</dd></div>
            {priced && priced.discount > 0 && <div className="order-summary-discount"><dt>Cupón {priced.coupon}</dt><dd>−{money(priced.discount)}</dd></div>}
            <div><dt>Envío</dt><dd>{quote?.freeShippingCoupon ? "Gratis con tu cupón" : "Se calcula con tu dirección"}</dd></div>
            <div className="order-summary-total"><dt>Total sin envío</dt><dd>{money(payable)}</dd></div>
          </dl>
          <p className="cart-note">Precios con IVA incluido.</p>
          <CouponField code={cart.coupon} applied={Boolean(priced?.coupon)} discount={priced?.discount ?? 0} error={quote?.couponError ?? null} checking={checking} onApply={cart.setCoupon} />
          {failed && !quote && <p className="store-alert" role="alert">No pudimos revisar los precios. Revisa tu conexión.</p>}
          {priced?.blockers.map((blocker) => <p key={blocker} className="store-alert" role="alert">{blocker}. Agrega algo más para continuar.</p>)}
          {missing > 0 && <p className="order-summary-tip"><Truck size={18} weight="fill" aria-hidden="true" /> Te faltan {money(missing)} para el envío gratis en {localArea(profile)}.</p>}
          {blocked ? <span className="button-primary is-disabled" aria-disabled="true">Finalizar compra</span> : <Link href="/checkout" className="button-primary">Finalizar compra <ArrowRight size={18} weight="bold" aria-hidden="true" /></Link>}
          <Link href="/productos" className="cart-view">Seguir comprando</Link>
        </aside>
      </div>
    </div>
  )
}

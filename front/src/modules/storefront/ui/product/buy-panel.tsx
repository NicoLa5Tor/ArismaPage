"use client"

import { useEffect, useRef, useState } from "react"
import { CheckCircle, Clock, WhatsappLogo, XCircle } from "@phosphor-icons/react"
import { useCart } from "../../../cart/ui/cart-context"
import { flyToCart } from "../../../cart/ui/fly-to-cart"
import { Quantity } from "../../../cart/ui/quantity"
import { discountPercent, formatCop, productImageSrc, quoteMessage } from "../../domain/catalog"
import { type ProductDetail, availabilityLabel, canBuy, currentPrice } from "../../domain/product"
import { AddToCartButton } from "./add-to-cart-button"
import { useWhatsapp } from "../../../shared/ui/store-profile"
import { useQuoteLink } from "../quote-link"

/** Price, availability and the two ways to get the product: add it to the cart or ask for it on WhatsApp. */
export function BuyPanel({ detail }: { detail: ProductDetail }) {
  const whatsappUrl = useWhatsapp()
  const { product, availability, sections } = detail
  const quote = useQuoteLink(whatsappUrl(quoteMessage(product)))
  const cart = useCart()
  const [quantity, setQuantity] = useState(1)
  const [pinned, setPinned] = useState(false)
  const actions = useRef<HTMLDivElement>(null)
  const price = currentPrice(product)
  const discount = discountPercent(product)
  const buyable = canBuy(detail)
  const stock = availabilityLabel(availability)
  const max = Math.max(1, availability.maxQuantity)

  // On phones a slim bar keeps the price and the button at hand once the main ones scroll away.
  useEffect(() => {
    const el = actions.current
    if (!el || !("IntersectionObserver" in window)) return
    const observer = new IntersectionObserver(([entry]) => setPinned(!entry.isIntersecting && entry.boundingClientRect.top < 0))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const add = () => {
    const result = cart.add({ productId: product.id, slug: product.slug, title: product.title, unitPrice: price ?? 0, image: productImageSrc(product), maxQuantity: max }, quantity)
    if (result.added > 0) {
      flyToCart(document.querySelector<HTMLElement>("[data-product-photo]"))
      window.setTimeout(() => cart.setOpen(true), window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 750)
    }
    return result
  }
  const StockIcon = stock.tone === "good" ? CheckCircle : stock.tone === "warn" ? Clock : XCircle

  return (
    <div className="buy">
      <div className="buy-price">
        {price !== null ? (
          product.salePrice !== null && product.price !== null ? (
            <>
              <strong>{formatCop(product.salePrice)}</strong>
              <s aria-label={`Antes ${formatCop(product.price)}`}>{formatCop(product.price)}</s>
              {discount !== null && <span className="badge badge-sale">Ahorras {discount}%</span>}
            </>
          ) : <strong>{formatCop(price)}</strong>
        ) : <strong className="buy-quote">Precio a cotizar</strong>}
        {price !== null && <span className="buy-tax">IVA incluido</span>}
      </div>

      {sections.stock && <p className="buy-stock" data-tone={stock.tone}><StockIcon size={18} weight="fill" aria-hidden="true" /> {stock.text}</p>}

      <div ref={actions} className="buy-actions">
        {buyable && (
          <div className="buy-row">
            {max > 1 && <Quantity value={quantity} max={max} onChange={setQuantity} label="Cantidad" />}
            <AddToCartButton onAdd={add} className="buy-add" />
          </div>
        )}
        {sections.whatsapp && (
          // asking about a product is open to everyone; quoting one with no public price needs an account
          <a className={buyable ? "buy-whatsapp is-secondary squircle" : "buy-whatsapp squircle"} href={buyable ? whatsappUrl(quoteMessage(product)) : quote.href} {...(buyable || quote.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
            <WhatsappLogo size={20} weight="fill" aria-hidden="true" /> {buyable ? "Preguntar por WhatsApp" : quote.needsSignIn ? "Inicia sesión para cotizar" : "Cotizar por WhatsApp"}
          </a>
        )}
        {!buyable && !sections.whatsapp && <p className="buy-unavailable">Este producto no se puede comprar por la página en este momento.</p>}
      </div>

      {buyable && (
        <div className="buy-bar" data-shown={pinned} aria-hidden={!pinned} inert={!pinned || undefined}>
          <div><span>{product.title}</span><strong>{formatCop(price!)}</strong></div>
          <AddToCartButton onAdd={add} label="Agregar" />
        </div>
      )}
    </div>
  )
}

"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { motion, useReducedMotion } from "motion/react"
import { Check, ImageSquare, ShoppingBag, WhatsappLogo } from "@phosphor-icons/react"
import { useCart } from "../../../cart/ui/cart-context"
import { flyToCart } from "../../../cart/ui/fly-to-cart"
import { type CatalogProduct, discountPercent, formatCop, productImageSrc, quoteMessage } from "../../domain/catalog"
import { useWhatsapp } from "../../../shared/ui/store-profile"
import { optimized } from "../../../shared/ui/optimized-image"
import { useQuoteLink } from "../quote-link"

// Adapted from 21st.dev "Product Card" (beratberkayg): image well with stacked badges, price with the regular one struck
// through on sale, and an action button with a short confirmation state. Photo and name open the product page; the
// action adds to the cart when the product has a public price and stock, and quotes on WhatsApp when it does not.

const ease = [0.22, 1, 0.36, 1] as const

export function ProductCard({ product, index }: { product: CatalogProduct; index: number }) {
  const whatsappUrl = useWhatsapp()
  const quote = useQuoteLink(whatsappUrl(quoteMessage(product)))
  const reduce = useReducedMotion()
  const cart = useCart()
  const photo = useRef<HTMLImageElement>(null)
  const [broken, setBroken] = useState(false)
  const [done, setDone] = useState(false)
  const src = broken ? null : productImageSrc(product)
  const discount = discountPercent(product)
  const showPrice = product.price !== null && !product.quoteOnly
  const buyable = showPrice && product.inStock
  const href = `/producto/${encodeURIComponent(product.slug)}`

  useEffect(() => {
    if (!done) return
    const timer = window.setTimeout(() => setDone(false), 2400)
    return () => window.clearTimeout(timer)
  }, [done])

  // The card does not know the stock: it adds one unit and the product page and the checkout enforce the real limit.
  const add = () => {
    const result = cart.add({ productId: product.id, slug: product.slug, title: product.title, unitPrice: product.salePrice ?? product.price ?? 0, image: productImageSrc(product), maxQuantity: 99 })
    if (result.added > 0) flyToCart(photo.current)
    else cart.setOpen(true)
    setDone(true)
  }

  return (
    <motion.article
      className="product-card squircle"
      layout={reduce ? false : "position"}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.45, ease, delay: reduce ? 0 : Math.min(index % 24, 12) * 0.035 }}
    >
      <Link href={href} className="product-card-media squircle" tabIndex={-1} aria-hidden="true">
        {src ? (
          <img ref={photo} {...optimized(src, { sizes: "(min-width: 80rem) 18rem, (min-width: 64rem) 24vw, (min-width: 40rem) 33vw, 50vw", width: 640 })} alt="" loading="lazy" decoding="async" onError={() => setBroken(true)} />
        ) : (
          <span className="product-card-placeholder"><ImageSquare size={40} /></span>
        )}
        <span className="product-card-badges">
          {discount !== null && <span className="badge badge-sale">-{discount}%</span>}
          {product.featured && <span className="badge badge-featured">Destacado</span>}
          {!product.inStock && <span className="badge badge-muted">Agotado</span>}
        </span>
      </Link>

      <div className="product-card-body">
        <h3 title={product.title}><Link href={href}>{product.title}</Link></h3>
        <div className="product-card-price">
          {showPrice ? (
            product.salePrice !== null ? (
              <>
                <strong>{formatCop(product.salePrice)}</strong>
                <s aria-label={`Antes ${formatCop(product.price!)}`}>{formatCop(product.price!)}</s>
              </>
            ) : (
              <strong>{formatCop(product.price!)}</strong>
            )
          ) : (
            <span className="product-card-quote">Precio a cotizar</span>
          )}
        </div>
        {buyable ? (
          <button type="button" className="product-card-action is-cart squircle" data-sent={done} onClick={add}>
            {done ? <><Check size={18} weight="bold" aria-hidden="true" /> En el carrito</> : <><ShoppingBag size={18} weight="fill" aria-hidden="true" /> Agregar</>}
            <span className="sr-only">{product.title} al carrito</span>
          </button>
        ) : (
          <a className="product-card-action squircle" href={quote.href} {...(quote.external ? { target: "_blank", rel: "noopener noreferrer" } : {})} data-sent={done} onClick={() => { if (quote.external) setDone(true) }} title={quote.needsSignIn ? "Inicia sesión para cotizar" : undefined}>
            {done ? <><Check size={18} weight="bold" aria-hidden="true" /> Abierto en WhatsApp</> : <><WhatsappLogo size={18} weight="fill" aria-hidden="true" /> Cotizar</>}
            <span className="sr-only">{quote.needsSignIn ? `Inicia sesión para cotizar ${product.title}` : `${product.title} por WhatsApp`}</span>
          </a>
        )}
      </div>
    </motion.article>
  )
}

export function ProductCardSkeleton() {
  return (
    <div className="product-card squircle is-skeleton" aria-hidden="true">
      <div className="product-card-media squircle" />
      <div className="product-card-body"><span className="skeleton-line" /><span className="skeleton-line short" /><span className="skeleton-button squircle" /></div>
    </div>
  )
}

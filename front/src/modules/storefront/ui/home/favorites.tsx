"use client"

import Link from "next/link"
import gsap from "gsap"
import { ArrowRight } from "@phosphor-icons/react"
import type { CatalogProduct } from "../../domain/catalog"
import { ProductCard } from "../catalog/product-card"
import { type Scene, useScene } from "./scene"

// The cards start stacked like a deck in the middle of the grid and fan out to their places; on desktop each one tilts under the cursor.
function build(root: HTMLElement, { desktop }: Scene) {
  const grid = root.querySelector<HTMLElement>(".favorites-grid")!
  const cards = gsap.utils.toArray<HTMLElement>(".favorite", root)
  const middle = (cards.length - 1) / 2
  gsap.from(cards, {
    x: (_, card: HTMLElement) => { const box = grid.getBoundingClientRect(), own = card.getBoundingClientRect(); return box.left + box.width / 2 - (own.left + own.width / 2) },
    y: (_, card: HTMLElement) => { const box = grid.getBoundingClientRect(), own = card.getBoundingClientRect(); return box.top + box.height / 2 - (own.top + own.height / 2) + 96 },
    rotate: (index) => (index - middle) * 5, scale: 0.8, autoAlpha: 0, duration: 1.1, ease: "expo.out", stagger: 0.06,
    scrollTrigger: { trigger: grid, start: "top 75%", once: true },
  })

  if (!desktop) return
  const cleanups = cards.map((card) => {
    const surface = card.querySelector<HTMLElement>(".favorite-tilt")!
    gsap.set(surface, { transformPerspective: 800 })
    const rotateX = gsap.quickTo(surface, "rotationX", { duration: 0.5, ease: "power3.out" })
    const rotateY = gsap.quickTo(surface, "rotationY", { duration: 0.5, ease: "power3.out" })
    const move = (event: PointerEvent) => {
      const box = card.getBoundingClientRect()
      rotateY(((event.clientX - box.left) / box.width - 0.5) * 12)
      rotateX(-((event.clientY - box.top) / box.height - 0.5) * 12)
    }
    const leave = () => { rotateX(0); rotateY(0) }
    card.addEventListener("pointermove", move)
    card.addEventListener("pointerleave", leave)
    return () => { card.removeEventListener("pointermove", move); card.removeEventListener("pointerleave", leave) }
  })
  return () => cleanups.forEach((cleanup) => cleanup())
}

export function Favorites({ products, ranked }: { products: CatalogProduct[]; ranked: boolean }) {
  const ref = useScene<HTMLElement>(build)
  return (
    <section ref={ref} id="favoritos" className="favorites" aria-labelledby="favoritos-titulo">
      <div className="home-inner">
        <div className="section-head">
          <div>
            <p className="eyebrow">{ranked ? "Según los pedidos de la tienda" : "Para empezar"}</p>
            <h2 id="favoritos-titulo">{ranked ? "Los más pedidos por familias y colegios" : "Algunos productos del catálogo"}</h2>
          </div>
          <Link href="/productos" className="link-arrow">Ver todos los productos <ArrowRight size={18} weight="bold" aria-hidden="true" /></Link>
        </div>
        <ul className="favorites-grid">
          {products.map((product, index) => (
            <li key={product.id} className="favorite"><div className="favorite-tilt"><ProductCard product={product} index={index} /></div></li>
          ))}
        </ul>
      </div>
    </section>
  )
}

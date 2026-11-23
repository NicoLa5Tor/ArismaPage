"use client"

import Link from "next/link"
import { useState } from "react"
import { ArrowRight, ArrowUpRight, HandSwipeRight } from "@phosphor-icons/react"
import { type CatalogCategory, categoryMetaOf, formatCount } from "../../domain/catalog"
import { categoryIcon } from "../catalog/category-icons"
import { useInView } from "./scene"
import { optimized } from "../../../shared/ui/optimized-image"

// Desktop: the categories stand side by side as tall panels; the one under the pointer (or with focus) opens wide and
// shows what it holds. Phones get a swipeable row of whole cards. Nothing here holds the scroll.
export function Worlds({ categories }: { categories: CatalogCategory[] }) {
  const [active, setActive] = useState(0)
  const [ref, shown] = useInView<HTMLUListElement>({ threshold: 0.2 })
  return (
    <section id="mundos" className="worlds" aria-labelledby="mundos-titulo">
      <div className="worlds-head">
        <div>
          <p className="eyebrow">Explora por categoría</p>
          <h2 id="mundos-titulo">Cada categoría es un mundo para jugar</h2>
        </div>
        <Link href="/productos" className="link-arrow">Ver todo el catálogo <ArrowRight size={18} weight="bold" aria-hidden="true" /></Link>
        {categories.length > 1 && <p className="worlds-hint" aria-hidden="true"><HandSwipeRight size={20} weight="duotone" /> Desliza para ver las {categories.length} categorías</p>}
      </div>
      <div className="worlds-viewport">
        <ul ref={ref} className="worlds-track" data-shown={shown}>
          {categories.map((category, index) => {
            const meta = categoryMetaOf(category.slug, index)
            const Icon = categoryIcon(category.slug)
            const number = String(index + 1).padStart(2, "0")
            return (
              <li key={category.id} className="world" data-tone={meta.tone} data-active={index === active} style={{ "--i": index } as React.CSSProperties} onPointerEnter={() => setActive(index)}>
                <Link href={`/productos?categoria=${encodeURIComponent(category.slug)}`} className="world-card squircle" onFocus={() => setActive(index)}>
                  <div className="world-photo squircle">
                    {meta.image ? <img {...optimized(meta.image, { sizes: "(min-width: 64rem) 33vw, 100vw", width: 960 })} alt="" loading="lazy" width={960} height={720} /> : <Icon size={96} weight="duotone" aria-hidden="true" />}
                  </div>
                  <span className="world-tab" aria-hidden="true"><b>{number}</b><Icon size={28} weight="duotone" /></span>
                  <div className="world-copy squircle">
                    <span className="world-index" aria-hidden="true">{number}</span>
                    <h3><Icon size={28} weight="duotone" aria-hidden="true" /> {category.name}</h3>
                    {meta.blurb && <p>{meta.blurb}</p>}
                    <span className="world-count">{formatCount(category.productCount)} productos <ArrowUpRight size={18} weight="bold" aria-hidden="true" /></span>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}

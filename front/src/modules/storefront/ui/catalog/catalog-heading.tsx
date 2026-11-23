"use client"

import { motion, useReducedMotion } from "motion/react"
import { ArrowRight, CaretRight } from "@phosphor-icons/react"
import { type CatalogCategory, categoryMetaOf, categoryTrail, formatCount, mainCategories } from "../../domain/catalog"
import { CategoryIcon } from "./category-icons"
import { optimized } from "../../../shared/ui/optimized-image"

const ease = [0.22, 1, 0.36, 1] as const

/**
 * The catalog's title, kept short so the products start high on the screen. Inside a category it shows the category's photo
 * as a small badge and the path back up; on the whole catalog, a stack of category photos opens the explorer.
 */
export function CatalogHeading({ categories, current, total, onSelect, onExplore }: {
  categories: CatalogCategory[]
  current: string
  total: number
  onSelect: (slug: string) => void
  onExplore: () => void
}) {
  const reduce = useReducedMotion()
  const trail = current ? categoryTrail(categories, current) : []
  const category = trail[trail.length - 1] ?? null
  const main = trail[0] ?? null
  const mains = mainCategories(categories)
  const meta = main ? categoryMetaOf(main.slug, mains.indexOf(main)) : null
  const photos = mains.map((item) => categoryMetaOf(item.slug).image).filter((image): image is string => Boolean(image)).slice(0, 4)

  return (
    <motion.section key={current} className="catalog-heading" data-tone={meta?.tone ?? "pink"} aria-labelledby="catalogo-titulo"
      initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease }}>
      {category && (
        <span className="catalog-heading-badge squircle" aria-hidden="true">
          {meta?.image ? <img {...optimized(meta.image, { sizes: "56px", width: 56 })} alt="" decoding="async" /> : main ? <CategoryIcon slug={main.slug} size={28} weight="duotone" /> : null}
        </span>
      )}
      <div className="catalog-heading-copy">
        {category ? (
          <nav aria-label="Ruta" className="catalog-crumbs">
            <ol>
              <li><button type="button" onClick={() => onSelect("")}>Catálogo</button></li>
              {trail.slice(0, -1).map((step) => (
                <li key={step.id}><CaretRight size={12} weight="bold" aria-hidden="true" /><button type="button" onClick={() => onSelect(step.slug)}>{step.name}</button></li>
              ))}
              <li aria-current="page"><CaretRight size={12} weight="bold" aria-hidden="true" /><span>{category.name}</span></li>
            </ol>
          </nav>
        ) : null}
        <h1 id="catalogo-titulo">{category ? category.name : "Juguetes y material didáctico"}</h1>
        <p className="catalog-heading-lead">
          <span className="catalog-heading-count">{formatCount(category ? category.productCount : total)} productos</span>
          {category ? meta?.blurb && trail.length === 1 ? <> · {meta.blurb}</> : null : <> · Para la casa y el aula, con envío a toda Colombia.</>}
        </p>
      </div>
      {!category && photos.length > 0 && (
        <button type="button" className="catalog-heading-explore squircle" onClick={onExplore} aria-haspopup="dialog">
          <span className="catalog-heading-stack" aria-hidden="true">{photos.map((image) => <img key={image} {...optimized(image, { sizes: "40px", width: 40 })} alt="" decoding="async" />)}</span>
          <span>Explorar {mains.length} categorías</span>
          <ArrowRight size={16} weight="bold" aria-hidden="true" />
        </button>
      )}
    </motion.section>
  )
}

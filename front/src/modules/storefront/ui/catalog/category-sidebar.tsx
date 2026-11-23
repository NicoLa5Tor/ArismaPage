"use client"

import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { CaretRight, Receipt, SealPercent } from "@phosphor-icons/react"
import { type CatalogCategory, type CatalogFilters, categoryMetaOf, childCategories, formatCount } from "../../domain/catalog"

const ease = [0.22, 1, 0.36, 1] as const

/**
 * The organised way to browse: main categories as a tree, the open one showing its subcategories in order with counts,
 * then the two filters. Used as the desktop sidebar and inside the mobile filters sheet.
 */
export function CategorySidebar({ categories, mains, root, filters, onCategory, onToggle }: {
  categories: CatalogCategory[]
  mains: CatalogCategory[]
  root: CatalogCategory | null
  filters: CatalogFilters
  onCategory: (slug: string) => void
  onToggle: (key: "offers" | "priced") => void
}) {
  const reduce = useReducedMotion()
  return (
    <div className="category-sidebar">
      <section aria-labelledby="explorar-titulo">
        <h2 id="explorar-titulo" className="sidebar-title">Explorar</h2>
        <ul className="tree">
          <li>
            <button type="button" className="tree-item" aria-current={!filters.category} onClick={() => onCategory("")}>
              <span className="tree-dot" data-tone="ink" aria-hidden="true" /> Todo el catálogo
            </button>
          </li>
          {mains.map((category, index) => {
            const open = root?.id === category.id
            const subs = open ? childCategories(categories, category.id) : []
            return (
              <li key={category.id}>
                <button type="button" className="tree-item" aria-expanded={open} aria-current={open && filters.category === category.slug} onClick={() => onCategory(open && filters.category === category.slug ? "" : category.slug)}>
                  <span className="tree-dot" data-tone={categoryMetaOf(category.slug, index).tone} aria-hidden="true" />
                  <span className="tree-name">{category.name}</span>
                  <span className="tree-count">{formatCount(category.productCount)}</span>
                  <CaretRight className="tree-caret" size={14} weight="bold" aria-hidden="true" />
                </button>
                <AnimatePresence initial={false}>
                  {open && subs.length > 0 && (
                    <motion.ul className="tree-children" initial={reduce ? false : { height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }} transition={{ duration: 0.3, ease }}>
                      {subs.map((sub) => (
                        <li key={sub.id}>
                          <button type="button" className="tree-sub" aria-current={filters.category === sub.slug} onClick={() => onCategory(filters.category === sub.slug ? category.slug : sub.slug)}>
                            <span className="tree-name">{sub.name}</span>
                            <span className="tree-count">{formatCount(sub.productCount)}</span>
                          </button>
                        </li>
                      ))}
                    </motion.ul>
                  )}
                </AnimatePresence>
              </li>
            )
          })}
        </ul>
      </section>

      <section aria-labelledby="filtrar-titulo">
        <h2 id="filtrar-titulo" className="sidebar-title">Filtrar</h2>
        <div className="sidebar-toggles">
          <button type="button" className="switch" role="switch" aria-checked={filters.offers} onClick={() => onToggle("offers")}>
            <SealPercent size={18} aria-hidden="true" /><span>Solo ofertas</span><span className="switch-track" aria-hidden="true"><span className="switch-thumb" /></span>
          </button>
          <button type="button" className="switch" role="switch" aria-checked={filters.priced} onClick={() => onToggle("priced")}>
            <Receipt size={18} aria-hidden="true" /><span>Con precio publicado</span><span className="switch-track" aria-hidden="true"><span className="switch-thumb" /></span>
          </button>
        </div>
      </section>
    </div>
  )
}

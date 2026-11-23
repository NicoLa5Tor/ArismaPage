"use client"

import { useEffect, useRef } from "react"
import { motion } from "motion/react"
import { CaretLeft, SquaresFour } from "@phosphor-icons/react"
import { type CatalogCategory, categoryMetaOf, childCategories } from "../../domain/catalog"
import { categoryIcon } from "./category-icons"

/**
 * Phones only (the sidebar does this on a computer): one thin row of chips under the search. Browsing everything it lists
 * the main categories; inside one it lists that category's subcategories, so narrowing down is one tap away.
 */
export function CategoryTabs({ categories, mains, root, current, onSelect, onExplore }: {
  categories: CatalogCategory[]
  mains: CatalogCategory[]
  root: CatalogCategory | null
  current: string
  onSelect: (slug: string) => void
  onExplore: () => void
}) {
  const row = useRef<HTMLDivElement>(null)
  useEffect(() => {
    row.current?.querySelector<HTMLElement>('[aria-current="true"]')?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" })
  }, [current])

  const subs = root ? childCategories(categories, root.id) : []
  const tone = root ? categoryMetaOf(root.slug, mains.indexOf(root)).tone : "pink"

  return (
    <nav className="category-tabs" aria-label="Categorías">
      <div className="category-tabs-row" ref={row}>
        <button type="button" className="category-tab is-explore" data-tone="ink" onClick={onExplore} aria-haspopup="dialog">
          <SquaresFour size={18} weight="fill" aria-hidden="true" /><span>Categorías</span>
        </button>
        {root ? (
          <>
            <button type="button" className="category-tab" data-tone="ink" onClick={() => onSelect("")} aria-label="Volver a todo el catálogo">
              <CaretLeft size={16} weight="bold" aria-hidden="true" /><span>Todo</span>
            </button>
            <Tab label={root.name} icon={categoryIcon(root.slug)} tone={tone} active={current === root.slug} onSelect={() => onSelect(root.slug)} />
            {subs.map((sub) => <Tab key={sub.id} label={sub.name} tone={tone} active={current === sub.slug} onSelect={() => onSelect(current === sub.slug ? root.slug : sub.slug)} />)}
          </>
        ) : (
          mains.map((category, index) => (
            <Tab key={category.id} label={category.name} icon={categoryIcon(category.slug)} tone={categoryMetaOf(category.slug, index).tone} active={false} onSelect={() => onSelect(category.slug)} />
          ))
        )}
      </div>
    </nav>
  )
}

function Tab({ label, icon: Icon, tone, active, onSelect }: { label: string; icon?: typeof SquaresFour; tone: string; active: boolean; onSelect: () => void }) {
  return (
    <button type="button" className="category-tab" data-tone={tone} aria-current={active} onClick={onSelect}>
      {active && <motion.span layoutId="category-tab-active" className="category-tab-active squircle" transition={{ type: "spring", stiffness: 460, damping: 38 }} />}
      {Icon && <Icon size={18} weight={active ? "fill" : "regular"} aria-hidden="true" />}
      <span>{label}</span>
    </button>
  )
}

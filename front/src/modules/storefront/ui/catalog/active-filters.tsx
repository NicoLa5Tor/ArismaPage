"use client"

import { AnimatePresence, motion } from "motion/react"
import { X } from "@phosphor-icons/react"

export type ActiveFilter = { key: string; label: string; onRemove: () => void }

/** Every filter in use, each removable on its own, so the shopper always sees why the list looks the way it does. */
export function ActiveFilters({ items, onClearAll }: { items: ActiveFilter[]; onClearAll: () => void }) {
  if (items.length === 0) return null
  return (
    <div className="active-filters" aria-label="Filtros aplicados">
      <AnimatePresence initial={false} mode="popLayout">
        {items.map((item) => (
          <motion.button key={item.key} type="button" layout className="active-filter squircle" onClick={item.onRemove} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.2 }}>
            <span>{item.label}</span><X size={14} weight="bold" aria-hidden="true" /><span className="sr-only">Quitar filtro</span>
          </motion.button>
        ))}
      </AnimatePresence>
      {items.length > 1 && <button type="button" className="clear" onClick={onClearAll}>Quitar todos</button>}
    </div>
  )
}

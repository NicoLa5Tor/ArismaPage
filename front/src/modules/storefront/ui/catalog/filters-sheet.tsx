"use client"

import { useEffect, type ReactNode } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { X } from "@phosphor-icons/react"
import { useScrollLock } from "../../../shared/ui/scroll-lock"

const ease = [0.22, 1, 0.36, 1] as const

/** Bottom sheet for phones; closes on the backdrop, the X, Escape or the results button. */
export function FiltersSheet({ open, onClose, resultLabel, children }: { open: boolean; onClose: () => void; resultLabel: string; children: ReactNode }) {
  const reduce = useReducedMotion()
  useScrollLock(open)
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose() }
    window.addEventListener("keydown", onKey)
    return () => { window.removeEventListener("keydown", onKey) }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <div className="sheet-root">
          <motion.button type="button" className="sheet-backdrop" aria-label="Cerrar filtros" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} />
          <motion.div className="sheet squircle" role="dialog" aria-modal="true" aria-label="Filtros" initial={reduce ? { opacity: 0 } : { y: "100%" }} animate={reduce ? { opacity: 1 } : { y: 0 }} exit={reduce ? { opacity: 0 } : { y: "100%" }} transition={{ duration: 0.35, ease }}>
            <div className="sheet-head">
              <span className="sheet-grip" aria-hidden="true" />
              <h2>Categorías y filtros</h2>
              <button type="button" className="sheet-close" onClick={onClose} aria-label="Cerrar"><X size={20} aria-hidden="true" /></button>
            </div>
            <div className="sheet-body">{children}</div>
            <div className="sheet-foot"><button type="button" className="button-primary sheet-apply" onClick={onClose}>{resultLabel}</button></div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

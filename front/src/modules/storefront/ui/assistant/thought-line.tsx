"use client"

import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { CaretDown, Check, Sparkle } from "@phosphor-icons/react"
import type { AssistantStep } from "../../domain/assistant"

const ease = [0.23, 1, 0.32, 1] as const
const seconds = (ms: number) => (ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`)

/** "Buscando…" while working; afterwards the real steps the search took, with their real times, folded away. */
export function ThoughtLine({ working, steps }: { working: boolean; steps: AssistantStep[] }) {
  const [open, setOpen] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!working) return
    const t0 = performance.now()
    const timer = window.setInterval(() => setElapsed(Math.round(performance.now() - t0)), 100)
    return () => window.clearInterval(timer)
  }, [working])
  const total = steps.reduce((sum, step) => sum + step.ms, 0)

  return (
    <div className="thought" data-working={working}>
      <button type="button" className="thought-head" aria-expanded={open} disabled={working} onClick={() => setOpen(!open)}>
        <Sparkle className="thought-glyph" size={16} weight="fill" aria-hidden="true" />
        <span className="thought-label">{working ? "Buscando en el catálogo…" : `Buscado en ${seconds(total)}`}</span>
        {working ? <span className="thought-timer">{seconds(elapsed)}</span> : <CaretDown className="thought-caret" size={14} aria-hidden="true" />}
        <span className="sr-only" role="status">{working ? "Buscando" : "Búsqueda lista"}</span>
      </button>
      <AnimatePresence initial={false}>
        {open && !working && (
          <motion.ol className="thought-steps" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease }}>
            {steps.map((step) => <li key={step.label}><Check size={12} weight="bold" aria-hidden="true" /> {step.label} <span>{seconds(step.ms)}</span></li>)}
          </motion.ol>
        )}
      </AnimatePresence>
    </div>
  )
}

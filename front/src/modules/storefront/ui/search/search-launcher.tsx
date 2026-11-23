"use client"

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { AnimatePresence, motion, useAnimate, usePresence, useReducedMotion } from "motion/react"
import { MagnifyingGlass, X } from "@phosphor-icons/react"
import { useDialogFocus } from "../../../shared/ui/dialog-focus"
import { StoreSearch } from "./store-search"

const ease = [0.22, 1, 0.36, 1] as const
/** Wide enough that, once open, the clip only rounds the top corners and leaves the suggestions and the shadow alone. */
const OPENED = "inset(-2rem -2rem -100vh -2rem round 4rem)"

type Spot = { top: number; left: number; right: number; origin: DOMRect }

/**
 * The search for headers too tight for the full box (the home page's floating pill). Opening it grows the box out of the
 * magnifier until it covers the whole header, while the header's own pieces slide toward the middle and fade under it;
 * closing folds it back into the magnifier. "/" opens it from anywhere.
 */
export function SearchLauncher({ className = "", onOpenChange }: { className?: string; onOpenChange?: (open: boolean) => void }) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [spot, setSpot] = useState<Spot | null>(null)
  const button = useRef<HTMLButtonElement>(null)
  useEffect(() => setMounted(true), [])

  const change = (next: boolean) => {
    if (next) setSpot(headerSpot(button.current))
    setOpen(next)
    onOpenChange?.(next)
  }
  const close = () => change(false)

  useEffect(() => {
    if (open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey) return
      if ((event.target as HTMLElement | null)?.closest("input, textarea, select, [contenteditable='true']")) return
      event.preventDefault()
      change(true)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  return (
    <>
      <button ref={button} type="button" className={`search-launcher squircle ${className}`} onClick={() => change(true)} aria-haspopup="dialog" aria-expanded={open} aria-label="Buscar productos">
        <MagnifyingGlass size={20} weight="bold" aria-hidden="true" />
        <span className="search-launcher-label">Buscar</span>
      </button>
      {mounted && createPortal(
        <AnimatePresence>
          {open && (
            <div className="storefront search-launch-root" data-lenis-prevent>
              <motion.button type="button" className="search-launch-backdrop" aria-label="Cerrar la búsqueda" tabIndex={-1} onClick={close}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} />
              <LaunchPanel spot={spot} onClose={close} />
            </div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  )
}

/** Where the header's row sits, so the box can cover it exactly; null when the launcher is not inside a header. */
function headerSpot(from: HTMLElement | null): Spot | null {
  const header = from?.closest("header")
  const row = from?.closest("nav") ?? header
  if (!header || !row) return null
  const brand = header.querySelector(".brand")?.getBoundingClientRect()
  const bar = row.getBoundingClientRect()
  const left = Math.min(brand?.left ?? bar.left, bar.left)
  return { top: Math.max(8, bar.top + bar.height / 2 - 32), left, right: Math.max(8, window.innerWidth - bar.right), origin: from!.getBoundingClientRect() }
}

/** The clip that shows only the magnifier's own rectangle of the box, as a pill. */
function clipAt(box: DOMRect, origin: DOMRect) {
  const top = origin.top - box.top
  const left = origin.left - box.left
  const right = box.right - origin.right
  const bottom = box.bottom - origin.bottom
  return `inset(${top}px ${right}px ${bottom}px ${left}px round 999px)`
}

function LaunchPanel({ spot, onClose }: {
  spot: Spot | null
  onClose: () => void
}) {
  const reduce = useReducedMotion()
  const [scope, animate] = useAnimate<HTMLDivElement>()
  const [isPresent, safeToRemove] = usePresence()
  const grows = !reduce && spot !== null
  useDialogFocus(isPresent, scope, onClose)

  useLayoutEffect(() => {
    const box = scope.current.getBoundingClientRect()
    const from = spot?.origin
    if (!grows || !from) {
      animate(scope.current, { opacity: [0, 1], y: reduce ? 0 : [-16, 0] }, { duration: 0.3, ease })
      return
    }
    animate(scope.current, { clipPath: [clipAt(box, from), OPENED], opacity: [0.6, 1] }, { duration: 0.55, ease })
  }, [animate, grows, reduce, scope, spot])

  useEffect(() => {
    if (isPresent) return
    const box = scope.current.getBoundingClientRect()
    const from = spot?.origin
    const done = grows && from
      ? animate(scope.current, { clipPath: [OPENED, clipAt(box, from)], opacity: [1, 0.6, 0] }, { duration: 0.45, ease, opacity: { duration: 0.45, times: [0, 0.8, 1] } })
      : animate(scope.current, { opacity: 0 }, { duration: 0.2 })
    done.then(() => safeToRemove?.())
  }, [animate, grows, isPresent, safeToRemove, scope, spot])

  return (
    <div ref={scope} className="search-launch squircle" data-spot={spot ? "header" : undefined} role="dialog" aria-modal="true" aria-label="Buscar productos"
      style={spot ? { top: spot.top, left: spot.left, right: spot.right, opacity: 0 } : { opacity: 0 }}>
      <StoreSearch autoFocus shortcut={false} onDone={onClose} />
      <button type="button" className="search-launch-close" onClick={onClose} aria-label="Cerrar la búsqueda"><X size={20} aria-hidden="true" /></button>
    </div>
  )
}

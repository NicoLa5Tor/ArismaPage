"use client"

import { type RefObject, useEffect, useRef, useState } from "react"

const FOCUSABLE = "a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex='-1'])"

/**
 * Focus handling of a modal panel: focus moves in when it opens (to `[data-autofocus]` or the first control), Tab stays
 * inside, Escape closes it, and focus goes back to whatever opened it.
 */
export function useDialogFocus(open: boolean, panel: RefObject<HTMLElement | null>, onClose: () => void) {
  const close = useRef(onClose)
  useEffect(() => { close.current = onClose })

  useEffect(() => {
    if (!open) return
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const frame = requestAnimationFrame(() => {
      const root = panel.current
      ;(root?.querySelector<HTMLElement>("[data-autofocus]") ?? root?.querySelector<HTMLElement>(FOCUSABLE))?.focus()
    })
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); close.current(); return }
      if (event.key !== "Tab" || !panel.current) return
      const focusable = Array.from(panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((element) => element.offsetParent !== null)
      if (focusable.length === 0) return
      const first = focusable[0], last = focusable[focusable.length - 1]
      if (!panel.current.contains(document.activeElement)) { event.preventDefault(); first.focus() }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener("keydown", onKey)
    return () => { cancelAnimationFrame(frame); document.removeEventListener("keydown", onKey); opener?.focus() }
  }, [open, panel])
}

/** True while the screen matches the media query; false on the server and on the first render. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)
  useEffect(() => {
    const media = window.matchMedia(query)
    const update = () => setMatches(media.matches)
    update()
    media.addEventListener("change", update)
    return () => media.removeEventListener("change", update)
  }, [query])
  return matches
}

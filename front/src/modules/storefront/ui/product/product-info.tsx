"use client"

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react"
import gsap from "gsap"
import { CaretDown } from "@phosphor-icons/react"
import { InfoPanelContext, type InfoPanel } from "../../../shared/ui/info-panel"

// the home's scene helper brings GSAP's scroll plugins with it; this page only needs the plain tweens
const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches

/** One part of the product's information. `id` is also its address (#opiniones). */
export type ProductPanel = { id: string; label: string; count?: number; content: ReactNode }

const WIDE = "(min-width: 64rem)"
const EASE = "power3.out"

/**
 * The product's information in one box. On a wide screen it is a row of tabs: the pink line slides to the chosen
 * one and the box grows or shrinks to its content while the content rises in (GSAP). On a phone each part is a row
 * that unfolds under its title, the first one open. A link to #opiniones (or any part) opens that part and goes
 * there. With reduced motion everything changes at once. The content comes rendered from the server, so all of it is
 * in the page for search engines even while folded.
 */
export function ProductInfo({ panels, label }: { panels: ProductPanel[]; label: string }) {
  const [gone, setGone] = useState<string[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const shown = useMemo(() => panels.filter((p) => !gone.includes(p.id)), [panels, gone])
  const [active, setActive] = useState(panels[0]?.id ?? "")
  const [open, setOpen] = useState<string[]>(panels[0] ? [panels[0].id] : [])
  const [wide, setWide] = useState(true)
  const box = useRef<HTMLDivElement>(null), tabs = useRef<HTMLDivElement>(null), line = useRef<HTMLSpanElement>(null)
  const fromHeight = useRef<number | null>(null), unfolding = useRef<string | null>(null)
  const current = shown.some((p) => p.id === active) ? active : shown[0]?.id ?? ""

  // one context per panel: its content may hide its tab (nothing to show) or give its count
  const contexts = useMemo(() => Object.fromEntries(panels.map((p) => [p.id, {
    hide: () => setGone((g) => (g.includes(p.id) ? g : [...g, p.id])),
    count: (n: number) => setCounts((c) => (c[p.id] === n ? c : { ...c, [p.id]: n })),
  } satisfies InfoPanel])), [panels])

  useEffect(() => {
    const query = window.matchMedia(WIDE)
    const follow = () => setWide(query.matches)
    follow()
    query.addEventListener("change", follow)
    return () => query.removeEventListener("change", follow)
  }, [])

  // a link to one of the parts (#opiniones) opens it and scrolls there, on arrival and on every click
  useEffect(() => {
    const ids = new Set(panels.map((p) => p.id))
    const reveal = (id: string, smooth: boolean) => {
      if (!ids.has(id)) return false
      setActive(id); setOpen((o) => (o.includes(id) ? o : [...o, id]))
      requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: smooth && !prefersReducedMotion() ? "smooth" : "auto", block: "start" }))
      return true
    }
    reveal(decodeURIComponent(window.location.hash.slice(1)), false)
    const onClick = (event: MouseEvent) => {
      const link = (event.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#"]')
      const id = link?.getAttribute("href")?.slice(1) ?? ""
      if (link && reveal(id, true)) { event.preventDefault(); history.replaceState(null, "", `#${id}`) }
    }
    const onHash = () => reveal(decodeURIComponent(window.location.hash.slice(1)), true)
    document.addEventListener("click", onClick)
    window.addEventListener("hashchange", onHash)
    return () => { document.removeEventListener("click", onClick); window.removeEventListener("hashchange", onHash) }
  }, [panels])

  // the pink line under the chosen tab
  useLayoutEffect(() => {
    const tab = tabs.current?.querySelector<HTMLElement>(`[data-tab="${current}"]`), el = line.current
    if (!tab || !el || !wide) return
    const to = { x: tab.offsetLeft, width: tab.offsetWidth }
    if (el.dataset.placed && !prefersReducedMotion()) gsap.to(el, { ...to, duration: 0.45, ease: EASE, overwrite: true })
    else { gsap.set(el, to); el.dataset.placed = "true" }
  }, [current, wide, shown.length, counts])

  // changing tab: the box goes from its old height to the new one and the content rises in
  useLayoutEffect(() => {
    const el = box.current, start = fromHeight.current
    fromHeight.current = null
    if (!el || start == null || !wide || prefersReducedMotion()) return
    const body = el.querySelector<HTMLElement>(`[data-panel="${current}"] .pinfo-inner`)
    gsap.fromTo(el, { height: start }, { height: "auto", duration: 0.5, ease: EASE, clearProps: "height", overwrite: true })
    if (body) gsap.fromTo(body, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.45, delay: 0.05, ease: EASE, clearProps: "opacity,visibility,transform" })
  }, [current, wide])

  // a part unfolding on a phone
  useLayoutEffect(() => {
    const id = unfolding.current
    unfolding.current = null
    if (!id || prefersReducedMotion()) return
    const body = box.current?.querySelector<HTMLElement>(`[data-panel="${id}"] .pinfo-body`)
    if (body) gsap.fromTo(body, { height: 0 }, { height: "auto", duration: 0.45, ease: EASE, clearProps: "height" })
  }, [open])

  function choose(id: string, focus = false) {
    if (id !== current) { fromHeight.current = box.current?.offsetHeight ?? null; setActive(id) }
    if (focus) tabs.current?.querySelector<HTMLElement>(`[data-tab="${id}"]`)?.focus()
  }
  function onTabKey(event: KeyboardEvent) {
    const at = shown.findIndex((p) => p.id === current)
    const next = { ArrowRight: at + 1, ArrowLeft: at - 1, Home: 0, End: shown.length - 1 }[event.key]
    if (next === undefined) return
    event.preventDefault()
    choose(shown[(next + shown.length) % shown.length].id, true)
  }
  function toggle(id: string) {
    if (!open.includes(id)) { unfolding.current = id; setOpen((o) => [...o, id]); return }
    const body = box.current?.querySelector<HTMLElement>(`[data-panel="${id}"] .pinfo-body`)
    const close = () => setOpen((o) => o.filter((x) => x !== id))
    if (!body || prefersReducedMotion()) { close(); return }
    gsap.to(body, { height: 0, duration: 0.35, ease: "power2.inOut", onComplete: () => { close(); gsap.set(body, { clearProps: "height" }) } })
  }

  if (shown.length === 0) return null
  const name = (p: ProductPanel) => <>{p.label}{(counts[p.id] ?? p.count ?? 0) > 0 && <span className="pinfo-count">{counts[p.id] ?? p.count}</span>}</>
  return (
    <section className="pinfo squircle" aria-label={label}>
      <div ref={tabs} className="pinfo-tabs" role="tablist" aria-label={label} onKeyDown={onTabKey}>
        {shown.map((p) => (
          <button key={p.id} type="button" role="tab" id={`tab-${p.id}`} data-tab={p.id} aria-selected={p.id === current} aria-controls={`${p.id}-body`}
            tabIndex={p.id === current ? 0 : -1} onClick={() => choose(p.id)}>{name(p)}</button>
        ))}
        <span ref={line} className="pinfo-line" aria-hidden="true" />
      </div>
      <div ref={box} className="pinfo-box">
        {shown.map((p) => {
          const unfolded = open.includes(p.id)
          return (
            <div key={p.id} id={p.id} className="pinfo-panel" data-panel={p.id} data-active={p.id === current || undefined} data-open={unfolded || undefined}>
              <h2 className="pinfo-head">
                <button type="button" aria-expanded={unfolded} aria-controls={`${p.id}-body`} onClick={() => toggle(p.id)}>
                  <span>{name(p)}</span><CaretDown size={20} weight="bold" aria-hidden="true" />
                </button>
              </h2>
              <div id={`${p.id}-body`} className="pinfo-body" {...(wide ? { role: "tabpanel", "aria-labelledby": `tab-${p.id}`, tabIndex: 0 } : {})}>
                <div className="pinfo-inner"><InfoPanelContext.Provider value={contexts[p.id]}>{p.content}</InfoPanelContext.Provider></div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

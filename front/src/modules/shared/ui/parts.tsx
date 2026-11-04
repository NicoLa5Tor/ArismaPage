"use client"

import { useCallback, useEffect, useId, useRef, useState, type DependencyList, type ReactNode } from "react"
import { MagnifyingGlass, Warning, X, type Icon } from "@phosphor-icons/react"
import { PAGE_SIZE } from "../domain/page"
import { count } from "./format"

/** Loads data when dependencies change; ignores stale responses so fast filtering never shows old results. */
export function useLoad<T>(load: () => Promise<T>, deps: DependencyList) {
  const [tick, setTick] = useState(0)
  const key = JSON.stringify([...deps, tick])
  // "loading" is derived: the last settled request key differs from the current one.
  const [state, setState] = useState<{ data: T | null; error: string; key: string | null }>({ data: null, error: "", key: null })
  const ref = useRef(load)
  useEffect(() => { ref.current = load })
  useEffect(() => {
    let active = true
    ref.current().then(data => { if (active) setState({ data, error: "", key }) }).catch(e => { if (active) setState(s => ({ ...s, error: e instanceof Error ? e.message : "Error de conexión", key })) })
    return () => { active = false }
  }, [key])
  return { data: state.data, error: state.key === key ? state.error : "", loading: state.key !== key, reload: useCallback(() => setTick(t => t + 1), []) }
}
export type Loaded<T> = ReturnType<typeof useLoad<T>>

/** Debounced copy of a value for search fields. */
export function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value)
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t) }, [value, ms])
  return v
}

export function Card({ icon: IconCmp, title, subtitle, actions, children, className = "" }: { icon: Icon; title: string; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  const headingId = useId()
  return <section className={`glass-card ${className}`} aria-labelledby={headingId}>
    <div className="flex flex-wrap items-start justify-between gap-4"><div className="flex min-w-0 items-center gap-4"><span className="glass-icon-tile"><IconCmp size={20} aria-hidden="true" /></span><div className="min-w-0"><h2 id={headingId} className="text-lg font-semibold">{title}</h2>{subtitle && <p className="mt-1 text-sm text-stone-500">{subtitle}</p>}</div></div>{actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}</div>
    {children}
  </section>
}

export function Loading({ label, rows = 3 }: { label: string; rows?: number }) {
  return <div role="status" aria-label={label} className="mt-4 grid gap-2">{Array.from({ length: rows }, (_, i) => <div key={i} className="glass-skeleton" />)}</div>
}
export function Empty({ icon: IconCmp, title, hint, action }: { icon: Icon; title: string; hint?: string; action?: ReactNode }) {
  return <div className="glass-empty"><IconCmp size={28} aria-hidden="true" className="mx-auto text-stone-400" /><p className="mt-4 text-sm font-semibold">{title}</p>{hint && <p className="mt-2 text-sm text-stone-500">{hint}</p>}{action && <div className="mt-4">{action}</div>}</div>
}
export function Failure({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div role="alert" className="glass-alert"><span className="flex items-center gap-2"><Warning size={18} aria-hidden="true" />{message}</span><button type="button" className="glass-chip" onClick={onRetry}>Reintentar</button></div>
}
/** Loading, error and empty states in one place; renders children only with data. Keeps old data visible (dimmed) while refreshing. */
export function Async<T>({ state, label, rows, empty, children }: { state: Loaded<T>; label: string; rows?: number; empty?: { icon: Icon; title: string; hint?: string; action?: ReactNode; when: (data: T) => boolean }; children: (data: T) => ReactNode }) {
  if (state.error) return <Failure message={state.error} onRetry={state.reload} />
  if (state.loading && state.data == null) return <Loading label={label} rows={rows} />
  if (state.data == null) return null
  if (empty && empty.when(state.data)) return <Empty icon={empty.icon} title={empty.title} hint={empty.hint} action={empty.action} />
  return <div aria-busy={state.loading} className={`transition-opacity ${state.loading ? "opacity-60" : ""}`}>{children(state.data)}</div>
}

export function Pager({ offset, total, onChange, size = PAGE_SIZE }: { offset: number; total: number; onChange: (offset: number) => void; size?: number }) {
  if (total <= size && offset === 0) return total > 0 ? <p className="mt-4 text-xs text-stone-500">{count(total)} en total</p> : null
  return <nav aria-label="Paginación" className="mt-4 flex flex-wrap items-center justify-between gap-4"><span className="text-xs text-stone-500">{`${count(offset + 1)} a ${count(Math.min(offset + size, total))} de ${count(total)}`}</span>
    <div className="flex gap-2"><button type="button" className="glass-chip" disabled={offset === 0} onClick={() => onChange(Math.max(0, offset - size))}>Anterior</button><button type="button" className="glass-chip" disabled={offset + size >= total} onClick={() => onChange(offset + size)}>Siguiente</button></div></nav>
}

export function Search({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return <label className="glass-search"><span className="sr-only">{label}</span><MagnifyingGlass size={18} aria-hidden="true" /><input type="search" className="glass-field" value={value} onChange={e => onChange(e.target.value)} placeholder={label} />{value && <button type="button" aria-label="Borrar búsqueda" onClick={() => onChange("")}><X size={14} aria-hidden="true" /></button>}</label>
}

export type Tone = "good" | "warn" | "bad" | "info" | "neutral"
export const Badge = ({ tone, children }: { tone: Tone; children: ReactNode }) => <span className="glass-badge" data-tone={tone}>{children}</span>

/** Filter chips with counts, e.g. order statuses. */
export function Chips<T extends string>({ label, value, options, onChange }: { label: string; value: T | ""; options: { value: T | ""; label: string; count?: number }[]; onChange: (v: T | "") => void }) {
  return <div className="glass-presets" role="group" aria-label={label}>{options.map(o => <button key={o.value || "all"} type="button" className="glass-preset" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>{o.label}{o.count != null && <span className="glass-preset-count">{count(o.count)}</span>}</button>)}</div>
}

type DialogProps = {
  eyebrow: string; title: string; children: ReactNode; onClose: () => void
  /** Badges and short facts under the title. */
  meta?: ReactNode
  /** Image or avatar beside the title. */
  media?: ReactNode
  /** Sticky action bar at the bottom. */
  footer?: ReactNode
  size?: "md" | "lg" | "xl"; busy?: boolean
  /** When set, closing asks before discarding (e.g. unsaved changes). */
  confirmClose?: string | null
}
export function Dialog({ eyebrow, title, meta, media, footer, size = "md", busy = false, confirmClose, onClose, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const headingId = useId()
  const [asking, setAsking] = useState(false)
  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
    return () => { if (dialog?.open) dialog.close() }
  }, [])
  const request = () => { if (busy) return; if (confirmClose) setAsking(true); else onClose() }
  return <dialog ref={ref} aria-labelledby={headingId} data-size={size} onCancel={event => { event.preventDefault(); request() }} onClick={e => { if (e.target === ref.current) request() }} className="glass-dialog">
    <div className="glass-dialog-head">{media && <div className="glass-dialog-media">{media}</div>}<div className="min-w-0 flex-1"><p>{eyebrow}</p><h2 id={headingId}>{title}</h2>{meta && <div className="glass-dialog-meta">{meta}</div>}</div><button type="button" disabled={busy} onClick={request} aria-label="Cerrar ventana" className="glass-round"><X size={20} aria-hidden="true" /></button></div>
    <div className="glass-dialog-body">{children}</div>
    {(footer || asking) && <div className="glass-dialog-foot">{asking ? <div role="alertdialog" aria-label="Cambios sin guardar" className="glass-dialog-confirm"><span>{confirmClose}</span><span className="flex flex-wrap gap-2"><button type="button" className="glass-chip" autoFocus onClick={() => setAsking(false)}>Seguir editando</button><button type="button" className="glass-chip glass-chip-danger" onClick={onClose}>Descartar cambios</button></span></div> : footer}</div>}
  </dialog>
}

export function Facts({ items }: { items: [string, ReactNode][] }) {
  return <dl className="glass-facts">{items.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v || "—"}</dd></div>)}</dl>
}

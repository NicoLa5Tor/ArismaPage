"use client"

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react"
import { Check, Copy, EnvelopeSimple, ImageSquare, Minus, Phone, Plus, WhatsappLogo, type Icon } from "@phosphor-icons/react"
import type { ImageRef } from "../domain/image"
import type { MediaPort } from "../application/media-port"
import { usePort } from "./admin-context"
import { optimized } from "./optimized-image"

export const useMedia = () => usePort<MediaPort>("media")

/** Product thumbnail with a neutral placeholder when there is no photo or it fails to load. */
export function Thumb({ image, alt = "", size = 48 }: { image: ImageRef | null; alt?: string; size?: number }) {
  const media = useMedia()
  const src = image ? media.src(image) : null
  const [failed, setFailed] = useState(false)
  return <span className="glass-thumb" style={{ width: size, height: size }}>
    {src && !failed ? <img {...optimized(src, { sizes: `${size}px`, width: size })} alt={alt} loading="lazy" decoding="async" onError={() => setFailed(true)} /> : <ImageSquare size={Math.round(size / 2.4)} aria-hidden="true" />}
  </span>
}

/** Accessible tabs: arrow keys move between tabs, Home/End jump to the ends, panels stay mounted only while active. */
export function Tabs<T extends string>({ label, tabs, value, onChange }: { label: string; tabs: { id: T; label: string; badge?: ReactNode; alert?: boolean }[]; value: T; onChange: (id: T) => void }) {
  const base = useId()
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const onKey = (e: KeyboardEvent, i: number) => {
    const last = tabs.length - 1
    const next = e.key === "ArrowRight" ? (i === last ? 0 : i + 1) : e.key === "ArrowLeft" ? (i === 0 ? last : i - 1) : e.key === "Home" ? 0 : e.key === "End" ? last : -1
    if (next < 0) return
    e.preventDefault(); onChange(tabs[next].id); refs.current[next]?.focus()
  }
  return <div role="tablist" aria-label={label} className="glass-tabs">{tabs.map((t, i) =>
    <button key={t.id} ref={el => { refs.current[i] = el }} type="button" role="tab" id={`${base}-${t.id}`} aria-selected={value === t.id} aria-controls={`${base}-${t.id}-panel`} tabIndex={value === t.id ? 0 : -1} className="glass-tab" onClick={() => onChange(t.id)} onKeyDown={e => onKey(e, i)}>
      {t.label}{t.badge != null && <span className="glass-tab-badge">{t.badge}</span>}{t.alert && <span className="glass-tab-alert" aria-label="Revisa esta pestaña" />}
    </button>)}</div>
}
export function TabPanel({ active, children }: { active: boolean; children: ReactNode }) {
  return active ? <div role="tabpanel" className="glass-tab-panel">{children}</div> : null
}

/** Initials in a colored circle; the color is stable per name. */
export function Avatar({ name, size = 56 }: { name: string; size?: number }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join("") || "?"
  const hue = Array.from(name).reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7)
  return <span className="glass-avatar-initials" aria-hidden="true" style={{ width: size, height: size, fontSize: size * 0.36, background: `hsl(${hue} 45% 38%)` }}>{initials}</span>
}

export function CopyButton({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false)
  useEffect(() => { if (!done) return; const t = setTimeout(() => setDone(false), 1800); return () => clearTimeout(t) }, [done])
  return <button type="button" className="glass-icon-button" aria-label={done ? "Copiado" : `Copiar ${label}`} title={done ? "Copiado" : `Copiar ${label}`}
    onClick={() => { void navigator.clipboard?.writeText(value).then(() => setDone(true)) }}>{done ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}</button>
}

/** Colombian mobile numbers become a WhatsApp link with the 57 country code. */
export function whatsappNumber(phone: string | null | undefined) {
  const digits = (phone ?? "").replace(/\D/g, "")
  if (/^3\d{9}$/.test(digits)) return `57${digits}`
  if (/^573\d{9}$/.test(digits)) return digits
  return null
}
/** Quick contact: email, call, WhatsApp (with an optional first message) and copy. */
export function ContactActions({ email, phone, message }: { email?: string | null; phone?: string | null; message?: string }) {
  const wa = whatsappNumber(phone)
  const action = (href: string, icon: Icon, text: string, external = false) => { const I = icon; return <a className="glass-contact" href={href} {...(external ? { target: "_blank", rel: "noreferrer" } : {})}><I size={16} aria-hidden="true" />{text}</a> }
  if (!email && !phone) return null
  return <div className="glass-contacts">
    {email && action(`mailto:${email}`, EnvelopeSimple, "Escribir correo")}
    {phone && action(`tel:${phone.replace(/[^\d+]/g, "")}`, Phone, "Llamar")}
    {wa && action(`https://wa.me/${wa}${message ? `?text=${encodeURIComponent(message)}` : ""}`, WhatsappLogo, "WhatsApp", true)}
  </div>
}

/** On/off row with a title and a short explanation; it is a real checkbox for assistive tech. */
export function Switch({ checked, onChange, title, hint, disabled }: { checked: boolean; onChange: (v: boolean) => void; title: string; hint?: string; disabled?: boolean }) {
  return <label className="glass-switch-row" data-disabled={disabled || undefined}>
    <span className="min-w-0"><span className="block text-sm font-semibold">{title}</span>{hint && <span className="mt-1 block text-xs text-stone-500">{hint}</span>}</span>
    <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={e => onChange(e.target.checked)} className="glass-switch" />
  </label>
}

/** One choice among a few, shown side by side. */
export function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string; icon?: Icon }[]; onChange: (v: T) => void }) {
  const name = useId()
  return <fieldset className="glass-segmented"><legend className="sr-only">{label}</legend>{options.map(o => <label key={o.value} data-checked={value === o.value || undefined}>
    <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} className="sr-only" />{o.icon && <o.icon size={16} aria-hidden="true" />}{o.label}</label>)}</fieldset>
}

/** Number input with − and + buttons for quick stock changes. */
export function Stepper({ value, onChange, label, min = 0 }: { value: string; onChange: (v: string) => void; label: string; min?: number }) {
  const n = value === "" ? null : Number(value)
  return <div className="glass-stepper"><button type="button" aria-label={`Restar uno a ${label}`} disabled={n == null || n <= min} onClick={() => onChange(String(Math.max(min, (n ?? 0) - 1)))}><Minus size={16} aria-hidden="true" /></button>
    <input type="number" inputMode="numeric" min={min} step={1} aria-label={label} value={value} onChange={e => onChange(e.target.value)} />
    <button type="button" aria-label={`Sumar uno a ${label}`} onClick={() => onChange(String((n ?? min - 1) + 1))}><Plus size={16} aria-hidden="true" /></button></div>
}

/** Progress through a lifecycle; terminal states that leave the happy path are shown instead of the last steps. */
export function StatusSteps({ steps, current, off }: { steps: { id: string; label: string }[]; current: string; off?: { label: string; tone: "bad" | "neutral" } }) {
  const index = steps.findIndex(s => s.id === current)
  return <ol className="glass-steps" aria-label="Progreso">
    {steps.map((s, i) => <li key={s.id} data-state={off ? (i === 0 ? "done" : "skipped") : i < index ? "done" : i === index ? "current" : "todo"} aria-current={!off && i === index ? "step" : undefined}><span className="glass-step-dot" aria-hidden="true">{(!off && i < index) || (off && i === 0) ? <Check size={12} /> : i + 1}</span>{s.label}</li>)}
    {off && <li data-state={off.tone}><span className="glass-step-dot" aria-hidden="true">!</span>{off.label}</li>}
  </ol>
}

/** Small labelled figure for dialog headers. */
export const Stat = ({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) =>
  <div className="glass-stat"><span>{label}</span><strong>{value}</strong>{hint && <small>{hint}</small>}</div>

/** Card inside a dialog: icon, title, optional action, content. */
export function Panel({ icon: I, title, children, action }: { icon: Icon; title: string; children: ReactNode; action?: ReactNode }) {
  return <section className="glass-panel"><header><span className="glass-panel-icon"><I size={16} aria-hidden="true" /></span><h3>{title}</h3>{action && <span className="ml-auto">{action}</span>}</header>{children}</section>
}
/** Label/value line for a <dl className="glass-rows">; hidden when there is no value. */
export const Row = ({ label, children }: { label: string; children: ReactNode }) => children ? <div className="glass-row"><dt>{label}</dt><dd>{children}</dd></div> : null

"use client"

import { Plus, X } from "@phosphor-icons/react"
import { LIMITS, type ProductPage, SECTIONS, type SectionKey, type Visibility } from "../domain/product-page"
import { Segmented } from "../../shared/ui/rich"
import { RichText } from "./rich-text"

/** The draft the tab edits: the page itself, description as HTML. */
export type PageDraft = ProductPage

const CHOICES: { value: Visibility; label: string }[] = [{ value: "inherit", label: "Como la tienda" }, { value: "show", label: "Mostrar" }, { value: "hide", label: "Ocultar" }]

/** Tab "Página" of the product editor: what the public page says and which of its sections it shows. */
export function PageFields({ value, onChange, error }: { value: PageDraft; onChange: (page: PageDraft) => void; error?: string }) {
  const set = <K extends keyof PageDraft>(key: K, next: PageDraft[K]) => onChange({ ...value, [key]: next })
  const setSection = (key: SectionKey, visibility: Visibility) => set("sections", { ...value.sections, [key]: visibility })
  return <div className="grid gap-6">
    {error && <p className="glass-field-error" role="alert">{error}</p>}
    <label className="glass-label">Descripción corta
      <textarea className="glass-field" rows={2} maxLength={LIMITS.short} value={value.shortDescription} onChange={e => set("shortDescription", e.target.value)} placeholder="Una o dos frases que salen junto al precio y en Google" />
      <span className="text-xs text-stone-500">{value.shortDescription.length} de {LIMITS.short} caracteres</span>
    </label>
    <RichText label="Descripción" value={value.descriptionHtml} onChange={html => set("descriptionHtml", html)} placeholder="Cuenta qué es, para qué sirve y qué trae." />

    <fieldset className="grid gap-2"><legend className="mb-2 text-sm font-semibold">Destacados</legend>
      {value.highlights.map((highlight, i) => <div key={i} className="flex gap-2">
        <input className="glass-field" aria-label={`Destacado ${i + 1}`} maxLength={LIMITS.highlight} value={highlight} onChange={e => set("highlights", value.highlights.map((h, j) => j === i ? e.target.value : h))} placeholder="Ej. Madera con bordes redondeados" />
        <button type="button" className="glass-icon-button" aria-label={`Quitar destacado ${i + 1}`} onClick={() => set("highlights", value.highlights.filter((_, j) => j !== i))}><X size={16} aria-hidden="true" /></button>
      </div>)}
      {value.highlights.length < LIMITS.highlights ? <button type="button" className="glass-chip w-fit" onClick={() => set("highlights", [...value.highlights, ""])}><Plus size={14} aria-hidden="true" /> Agregar destacado</button> : <p className="text-xs text-stone-500">Máximo {LIMITS.highlights} destacados.</p>}
    </fieldset>

    <fieldset className="grid gap-2"><legend className="mb-2 text-sm font-semibold">Ficha del producto</legend>
      {value.specs.map((spec, i) => <div key={i} className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
        <input className="glass-field" aria-label={`Dato ${i + 1}`} maxLength={LIMITS.label} value={spec.label} onChange={e => set("specs", value.specs.map((s, j) => j === i ? { ...s, label: e.target.value } : s))} placeholder="Material" />
        <input className="glass-field" aria-label={`Valor del dato ${i + 1}`} maxLength={LIMITS.value} value={spec.value} onChange={e => set("specs", value.specs.map((s, j) => j === i ? { ...s, value: e.target.value } : s))} placeholder="Madera" />
        <button type="button" className="glass-icon-button" aria-label={`Quitar dato ${i + 1}`} onClick={() => set("specs", value.specs.filter((_, j) => j !== i))}><X size={16} aria-hidden="true" /></button>
      </div>)}
      {value.specs.length < LIMITS.specs && <button type="button" className="glass-chip w-fit" onClick={() => set("specs", [...value.specs, { label: "", value: "" }])}><Plus size={14} aria-hidden="true" /> Agregar dato</button>}
    </fieldset>

    <fieldset className="grid gap-2"><legend className="mb-2 text-sm font-semibold">Qué se muestra en la página</legend>
      <p className="text-xs text-stone-500">«Como la tienda» sigue el ajuste general; elige Mostrar u Ocultar solo cuando este producto deba ser distinto.</p>
      {SECTIONS.map(section => <div key={section.key} className="glass-subpanel flex flex-wrap items-center justify-between gap-2">
        <span className="min-w-0"><span className="block text-sm font-semibold">{section.title}</span><span className="block text-xs text-stone-500">{section.hint}</span></span>
        <Segmented label={section.title} value={value.sections[section.key] ?? "inherit"} options={CHOICES} onChange={v => setSection(section.key, v)} />
      </div>)}
    </fieldset>
  </div>
}

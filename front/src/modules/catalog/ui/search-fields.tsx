"use client"

import { useId, useState, type KeyboardEvent } from "react"
import { X } from "@phosphor-icons/react"
import { type AgeDraft, MAX_KEYWORDS, ageError, cleanKeyword } from "../domain/search-profile"

/** Keywords as removable tags. Enter or a comma adds what was typed; Backspace on an empty field removes the last one. */
export function KeywordInput({ value, onChange, hint, disabled }: { value: string[]; onChange: (keywords: string[]) => void; hint: string; disabled?: boolean }) {
  const id = useId()
  const [draft, setDraft] = useState(""), [error, setError] = useState("")

  const add = (raw: string) => {
    const pieces = raw.split(",").map(piece => piece.trim()).filter(Boolean)
    if (!pieces.length) return
    const next = [...value]
    for (const piece of pieces) {
      const cleaned = cleanKeyword(piece)
      if ("error" in cleaned) { setError(`«${piece}»: ${cleaned.error}`); return }
      if (next.length >= MAX_KEYWORDS) { setError(`Máximo ${MAX_KEYWORDS} palabras clave`); return }
      if (!next.includes(cleaned.keyword)) next.push(cleaned.keyword)
    }
    setError(""); setDraft(""); onChange(next)
  }
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") { event.preventDefault(); add(draft) }
    else if (event.key === "Backspace" && draft === "" && value.length) onChange(value.slice(0, -1))
  }

  return <div className="grid gap-2">
    <label className="glass-label" htmlFor={id}>Palabras clave
      <input id={id} className="glass-field" value={draft} disabled={disabled} aria-invalid={!!error} aria-describedby={`${id}-hint`} placeholder="Escribe una y presiona Enter"
        onChange={event => { setDraft(event.target.value); setError("") }} onKeyDown={onKeyDown} onBlur={() => add(draft)} />
    </label>
    {error ? <p className="glass-field-error" role="alert">{error}</p> : <p id={`${id}-hint`} className="text-xs text-stone-500">{hint}</p>}
    {value.length > 0 && <ul className="glass-tag-list" aria-label="Palabras clave agregadas">{value.map(keyword => <li key={keyword}>{keyword}
      <button type="button" disabled={disabled} aria-label={`Quitar ${keyword}`} onClick={() => onChange(value.filter(k => k !== keyword))}><X size={12} aria-hidden="true" /></button></li>)}</ul>}
  </div>
}

/** Who it is for. Both empty means the store has not said. */
export function AgeRange({ value, onChange, hint, disabled }: { value: AgeDraft; onChange: (age: AgeDraft) => void; hint: string; disabled?: boolean }) {
  const error = ageError(value)
  return <fieldset className="grid gap-2"><legend className="mb-2 text-sm font-semibold">Edad recomendada</legend>
    <div className="glass-dates">
      <label className="glass-label">Desde (años)<input className="glass-field" type="number" min="0" max="99" step="1" inputMode="numeric" disabled={disabled} aria-invalid={!!error} value={value.ageMin} onChange={event => onChange({ ...value, ageMin: event.target.value })} /></label>
      <label className="glass-label">Hasta (años)<input className="glass-field" type="number" min="0" max="99" step="1" inputMode="numeric" disabled={disabled} aria-invalid={!!error} value={value.ageMax} onChange={event => onChange({ ...value, ageMax: event.target.value })} /></label>
    </div>
    {error ? <p className="glass-field-error" role="alert">{error}</p> : <p className="text-xs text-stone-500">{hint}</p>}
  </fieldset>
}

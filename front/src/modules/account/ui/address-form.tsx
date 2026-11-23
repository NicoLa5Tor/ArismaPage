"use client"

import { useEffect, useId, useState, type FormEvent } from "react"
import { Briefcase, CircleNotch, House, MapPin } from "@phosphor-icons/react"
import { LABELS, addressErrors, emptyAddress, type AddressDraft, type AddressErrors, type AddressLabel, type SavedAddress } from "../domain/address"
import { departments } from "../../shared/domain/colombia"
import { useAccount } from "./account-context"
import { useAddressBookPort } from "./use-address-book"

const LABEL_ICON: Record<AddressLabel, typeof House> = { casa: House, trabajo: Briefcase, otro: MapPin }

/**
 * A delivery address as Mercado Libre asks for it: who receives it and a phone, department, municipality (with the
 * department's official municipalities to pick from), neighbourhood, the address, flat or tower, notes for whoever
 * delivers it and whether it is a home or a workplace. It saves to the shopper's book and hands back the stored one.
 */
export function AddressForm({ editing, start, onSaved, onCancel, submitLabel = "Guardar dirección" }: {
  /** The address being changed; absent for a new one. */
  editing?: SavedAddress
  /** Values to start a new one with (the shopper's name and phone). */
  start?: Partial<AddressDraft>
  onSaved: (address: SavedAddress) => void
  onCancel?: () => void
  submitLabel?: string
}) {
  const port = useAddressBookPort()
  const { session } = useAccount()
  const id = useId()
  const [draft, setDraft] = useState<AddressDraft>(() => editing
    ? { label: editing.label, recipient: editing.recipient, phone: editing.phone, state: editing.state, city: editing.city, neighborhood: editing.neighborhood, street: editing.street, detail: editing.detail, instructions: editing.instructions, makeDefault: editing.isDefault }
    : { ...emptyAddress(), ...start })
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false), [error, setError] = useState("")
  const [cities, setCities] = useState<string[] | null>(null)

  useEffect(() => {
    let live = true
    if (draft.state) port.cities(draft.state).then((found) => { if (live) setCities(found) }).catch(() => { if (live) setCities([]) })
    else queueMicrotask(() => { if (live) setCities(null) })
    return () => { live = false }
  }, [draft.state, port])

  const errors: AddressErrors = addressErrors(draft)
  const shown: AddressErrors = submitted ? errors : {}
  const set = <K extends keyof AddressDraft>(key: K, value: AddressDraft[K]) => setDraft((current) => ({ ...current, [key]: value }))

  async function save(event: FormEvent) {
    event.preventDefault(); event.stopPropagation()
    setSubmitted(true); setError("")
    const first = Object.keys(errors)[0]
    if (first) { document.getElementById(`${id}-${first}`)?.focus(); return }
    if (!session) { setError("Tu sesión terminó. Vuelve a entrar para guardar la dirección."); return }
    setBusy(true)
    try { onSaved(editing ? await port.update(editing.id, draft, session.csrf) : await port.add(draft, session.csrf)) }
    catch (err) { setError(err instanceof Error ? err.message : "No se pudo guardar la dirección") }
    finally { setBusy(false) }
  }

  const field = (key: keyof AddressDraft, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}, optional = false) => (
    <label className="store-field"><span>{label}{optional && <span className="store-field-optional"> (opcional)</span>}</span>
      <input id={`${id}-${key}`} value={draft[key] as string} onChange={(e) => set(key, e.target.value as never)} aria-invalid={Boolean(shown[key])} {...props} />
      {shown[key] && <span className="store-field-error">{shown[key]}</span>}
    </label>
  )

  // a form inside the checkout form would submit both: this one is a group with its own button
  return <div className="address-form" role="group" aria-label={editing ? "Editar dirección" : "Nueva dirección"} onKeyDown={(e) => { if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") void save(e as unknown as FormEvent) }}>
    <fieldset className="address-label-choice"><legend>¿Es casa o trabajo?</legend>
      {LABELS.map((l) => { const Icon = LABEL_ICON[l.value]; return <label key={l.value} data-checked={draft.label === l.value || undefined}>
        <input type="radio" name={`${id}-label`} className="sr-only" checked={draft.label === l.value} onChange={() => set("label", l.value)} /><Icon size={18} aria-hidden="true" />{l.label}
      </label> })}
    </fieldset>
    <div className="checkout-fields">
      {field("recipient", "Nombre y apellido de quien recibe", { autoComplete: "name", maxLength: 80 })}
      {field("phone", "Celular de contacto", { type: "tel", autoComplete: "tel", inputMode: "tel", maxLength: 16 })}
      <label className="store-field">Departamento
        <select id={`${id}-state`} value={draft.state} onChange={(e) => { const state = e.target.value; setDraft((current) => ({ ...current, state, city: "" })); setCities(null) }} aria-invalid={Boolean(shown.state)} autoComplete="address-level1">
          <option value="">Elige uno</option>{departments.map((d) => <option key={d.code} value={d.code}>{d.name}</option>)}
        </select>
        {shown.state && <span className="store-field-error">{shown.state}</span>}
      </label>
      <label className="store-field">Municipio
        {/* only the department's official municipalities (DANE): no free text */}
        <select id={`${id}-city`} value={draft.city} onChange={(e) => set("city", e.target.value)} aria-invalid={Boolean(shown.city)} autoComplete="address-level2" disabled={!draft.state || !cities}>
          <option value="">{!draft.state ? "Primero elige el departamento" : !cities ? "Cargando municipios…" : cities.length ? "Elige uno" : "No pudimos cargar los municipios; vuelve a elegir el departamento"}</option>
          {/* an address saved before the list keeps its city visible until another is chosen */}
          {draft.city && cities && !cities.includes(draft.city) && <option value={draft.city}>{draft.city}</option>}
          {(cities ?? []).map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        {shown.city && <span className="store-field-error">{shown.city}</span>}
      </label>
      <div className="sm:col-span-2">{field("street", "Dirección", { autoComplete: "address-line1", maxLength: 120, placeholder: "Calle 10 # 20-30" })}</div>
      {field("detail", "Apartamento, torre o interior", { autoComplete: "address-line2", maxLength: 80, placeholder: "Torre 2, apto 301" }, true)}
      {field("neighborhood", "Barrio", { maxLength: 60 }, true)}
    </div>
    <label className="store-field"><span>Indicaciones para la entrega<span className="store-field-optional"> (opcional)</span></span>
      <textarea id={`${id}-instructions`} rows={2} maxLength={200} value={draft.instructions} onChange={(e) => set("instructions", e.target.value)} placeholder="Casa de rejas blancas, dejar en portería, timbre dañado…" />
      {shown.instructions && <span className="store-field-error">{shown.instructions}</span>}
    </label>
    {!editing?.isDefault && <label className="checkout-terms"><input type="checkbox" checked={draft.makeDefault} onChange={(e) => set("makeDefault", e.target.checked)} /> <span>Usar como dirección predeterminada</span></label>}
    {error && <p className="store-alert" role="alert">{error}</p>}
    <div className="address-form-actions">
      {onCancel && <button type="button" className="button-secondary squircle" onClick={onCancel} disabled={busy}>Cancelar</button>}
      <button type="button" className="button-primary" onClick={(e) => void save(e as unknown as FormEvent)} disabled={busy}>{busy ? <><CircleNotch className="spin" size={18} aria-hidden="true" /> Guardando…</> : submitLabel}</button>
    </div>
  </div>
}

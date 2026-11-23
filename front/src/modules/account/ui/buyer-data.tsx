"use client"

import { useEffect, useState, type FormEvent } from "react"
import { CircleNotch } from "@phosphor-icons/react"
import { emptyProfile, profileErrors, type Profile, type ProfileErrors } from "../domain/address"
import { documentTypes } from "../../shared/domain/colombia"
import { useAccount } from "./account-context"
import { useAddressBookPort } from "./use-address-book"

const message = (e: unknown) => (e instanceof Error ? e.message : "No se pudo completar. Inténtalo de nuevo.")

/** The fields of the buyer's own data; shared by «Mis datos» and the checkout. */
export function ProfileFields({ profile, onChange, shown, idPrefix }: { profile: Profile; onChange: (p: Profile) => void; shown: ProfileErrors; idPrefix: string }) {
  const set = <K extends keyof Profile>(key: K, value: Profile[K]) => onChange({ ...profile, [key]: value })
  const field = (key: keyof Profile, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}, optional = false) => (
    <label className="store-field"><span>{label}{optional && <span className="store-field-optional"> (opcional)</span>}</span>
      <input id={`${idPrefix}-${key}`} value={profile[key]} onChange={(e) => set(key, e.target.value)} aria-invalid={Boolean(shown[key])} {...props} />
      {shown[key] && <span className="store-field-error">{shown[key]}</span>}
    </label>
  )
  return <div className="checkout-fields">
    {field("firstName", "Nombre", { autoComplete: "given-name", maxLength: 60 })}
    {field("lastName", "Apellido", { autoComplete: "family-name", maxLength: 60 })}
    {field("phone", "Celular", { type: "tel", autoComplete: "tel", inputMode: "tel", maxLength: 16 })}
    <label className="store-field">Tipo de documento
      <select value={profile.documentType || "CC"} onChange={(e) => set("documentType", e.target.value)}>{documentTypes.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select>
    </label>
    {field("documentNumber", "Número de documento", { inputMode: "numeric", maxLength: 20 })}
    {field("company", "Empresa o institución", { autoComplete: "organization", maxLength: 100 }, true)}
  </div>
}

/** «Datos para comprar» in Mis datos: what the checkout fills in for the shopper. */
export function BuyerData() {
  const port = useAddressBookPort()
  const { session } = useAccount()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [submitted, setSubmitted] = useState(false), [busy, setBusy] = useState(false), [state, setState] = useState(""), [error, setError] = useState("")
  useEffect(() => {
    let live = true
    port.profile().then((p) => { if (live) setProfile({ ...emptyProfile, ...p, documentType: p.documentType || "CC" }) }).catch(() => { if (live) setProfile(emptyProfile) })
    return () => { live = false }
  }, [port])
  if (!session) return null
  const errors = profile ? profileErrors(profile) : {}
  async function save(event: FormEvent) {
    event.preventDefault(); setSubmitted(true); setState(""); setError("")
    if (!profile || Object.keys(errors).length) return
    setBusy(true)
    try { setProfile(await port.saveProfile(profile, session!.csrf)); setState("Guardado.") } catch (e) { setError(message(e)) } finally { setBusy(false) }
  }
  return <form className="checkout-card squircle" onSubmit={save} noValidate>
    <h2>Datos para comprar</h2>
    <p className="store-field-hint">Los usamos en tus pedidos y en la factura. Así no los escribes cada vez.</p>
    {!profile ? <p className="store-wait"><CircleNotch className="spin" size={18} aria-hidden="true" /> Cargando…</p> : <ProfileFields profile={profile} onChange={setProfile} shown={submitted ? errors : {}} idPrefix="perfil" />}
    {error && <p className="store-field-error" role="alert">{error}</p>}
    {state && <p className="account-ok" role="status">{state}</p>}
    <button type="submit" className="order-other squircle" disabled={busy || !profile}>{busy ? "Guardando…" : "Guardar datos"}</button>
  </form>
}

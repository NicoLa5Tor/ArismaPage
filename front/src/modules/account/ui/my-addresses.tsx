"use client"

import { useEffect, useState } from "react"
import { Briefcase, CircleNotch, House, MapPin, PencilSimple, Plus, Star, Trash } from "@phosphor-icons/react"
import { MAX_ADDRESSES, addressLines, labelName, type AddressLabel, type SavedAddress } from "../domain/address"
import { useAccount } from "./account-context"
import { AddressForm } from "./address-form"
import { useAddressBookPort } from "./use-address-book"

const LABEL_ICON: Record<AddressLabel, typeof House> = { casa: House, trabajo: Briefcase, otro: MapPin }
const message = (e: unknown) => (e instanceof Error ? e.message : "No se pudo completar. Inténtalo de nuevo.")

/** One saved address as a card: label, who receives it, the lines and what can be done with it. */
export function AddressCard({ address, actions }: { address: SavedAddress; actions?: React.ReactNode }) {
  const Icon = LABEL_ICON[address.label]
  const [line1, line2] = addressLines(address)
  return <div className="address-card squircle" data-default={address.isDefault || undefined}>
    <Icon size={22} aria-hidden="true" className="address-card-icon" />
    <div className="min-w-0 flex-1">
      <p className="address-card-head"><strong>{labelName(address.label)}</strong>{address.isDefault && <span className="address-default">Predeterminada</span>}</p>
      <p>{line1}</p>
      <p className="address-card-muted">{line2}</p>
      <p className="address-card-muted">Recibe {address.recipient} · {address.phone}</p>
      {address.instructions && <p className="address-card-muted">“{address.instructions}”</p>}
    </div>
    {actions}
  </div>
}

/** «Mis direcciones»: the saved addresses, to add, change, choose the default one or delete. */
export function MyAddresses() {
  const port = useAddressBookPort()
  const { session } = useAccount()
  const [book, setBook] = useState<SavedAddress[] | null>(null), [error, setError] = useState(""), [reload, setReload] = useState(0)
  const [editing, setEditing] = useState<SavedAddress | "new" | null>(null)
  const [busy, setBusy] = useState(""), [notice, setNotice] = useState("")
  const [confirming, setConfirming] = useState("")

  useEffect(() => {
    let live = true
    port.addresses().then((found) => { if (live) { setBook(found); setError("") } }).catch((e) => { if (live) setError(message(e)) })
    return () => { live = false }
  }, [port, reload])

  if (!session) return null
  const csrf = session.csrf
  async function act(id: string, work: () => Promise<void>, done: string) {
    setBusy(id); setError(""); setNotice("")
    try { await work(); setNotice(done) } catch (e) { setError(message(e)) } finally { setBusy("") }
  }
  const saved = (address: SavedAddress) => { setEditing(null); setNotice("Dirección guardada."); setReload((n) => n + 1); void address }

  if (editing) return <div className="checkout-card squircle">
    <h2>{editing === "new" ? "Nueva dirección" : "Editar dirección"}</h2>
    <AddressForm editing={editing === "new" ? undefined : editing} start={{ recipient: session.shopper.name }} onSaved={saved} onCancel={() => setEditing(null)} />
  </div>

  if (!book) return error
    ? <div className="posts-empty squircle"><p>{error}</p><button type="button" className="link-arrow" onClick={() => { setError(""); setReload((n) => n + 1) }}>Intentar de nuevo</button></div>
    : <p className="store-wait"><CircleNotch className="spin" size={18} aria-hidden="true" /> Cargando tus direcciones…</p>

  return <div className="account-addresses">
    {notice && <p className="account-ok" role="status">{notice}</p>}
    {error && <p className="store-alert" role="alert">{error}</p>}
    {book.length === 0 ? <div className="posts-empty squircle"><MapPin size={32} weight="fill" aria-hidden="true" />
      <p>Aún no tienes direcciones guardadas. Agrega la primera y la elegimos sola cuando compres.</p>
      <button type="button" className="button-primary" onClick={() => setEditing("new")}><Plus size={18} aria-hidden="true" /> Agregar dirección</button></div>
      : <>
        <ul className="address-list">{book.map((a) => <li key={a.id}><AddressCard address={a} actions={<div className="address-card-actions">
          {!a.isDefault && <button type="button" className="address-action" disabled={Boolean(busy)} onClick={() => void act(a.id, async () => setBook(await port.makeDefault(a.id, csrf)), "Ahora es tu dirección predeterminada.")}><Star size={16} aria-hidden="true" />{busy === a.id ? "…" : "Predeterminada"}</button>}
          <button type="button" className="address-action" disabled={Boolean(busy)} onClick={() => setEditing(a)}><PencilSimple size={16} aria-hidden="true" />Editar</button>
          {confirming === a.id
            ? <span className="address-confirm" role="group" aria-label="Confirmar eliminación"><span>¿Eliminarla?</span>
              <button type="button" className="address-action" data-tone="danger" disabled={Boolean(busy)} onClick={() => void act(a.id, async () => { await port.remove(a.id, csrf); setConfirming(""); setReload((n) => n + 1) }, "Dirección eliminada.")}>{busy === a.id ? "Eliminando…" : "Sí, eliminar"}</button>
              <button type="button" className="address-action" onClick={() => setConfirming("")}>No</button></span>
            : <button type="button" className="address-action" data-tone="danger" disabled={Boolean(busy)} onClick={() => setConfirming(a.id)}><Trash size={16} aria-hidden="true" />Eliminar</button>}
        </div>} /></li>)}</ul>
        {book.length < MAX_ADDRESSES ? <button type="button" className="order-other squircle" onClick={() => setEditing("new")}><Plus size={18} aria-hidden="true" /> Agregar otra dirección</button>
          : <p className="store-field-hint">Puedes guardar hasta {MAX_ADDRESSES} direcciones. Elimina una para agregar otra.</p>}
      </>}
  </div>
}

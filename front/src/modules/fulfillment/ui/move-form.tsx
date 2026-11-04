"use client"

import { useEffect, useId, useState, type FormEvent } from "react"
import { CARRIERS, missing, type Courier, type DeliveryMethod, type DeliveryStatus, type MoveDetails, type Shipment } from "../domain/fulfillment"
import { useSession } from "../../shared/ui/admin-context"
import { STEP_ACTION } from "./labels"
import { useFulfillmentPort } from "./use-fulfillment"

const FAIL_REASONS = ["No había nadie", "Dirección incorrecta", "El cliente no respondió", "El cliente lo rechazó"]

/** Asks only what the chosen step needs, then moves the delivery. */
export function MoveForm({ orderId, method, target, current, onDone, onCancel }: { orderId: string; method: DeliveryMethod; target: DeliveryStatus; current?: Partial<Shipment>; onDone: (s: Shipment) => void; onCancel: () => void }) {
  const api = useFulfillmentPort()
  const { csrf } = useSession()
  const listId = useId()
  const [d, setD] = useState<MoveDetails>({ carrier: current?.carrier ?? "", trackingCode: current?.trackingCode ?? "", courierUserId: current?.courierUserId ?? null, courierName: "", recipientName: "", reason: "", note: "" })
  const [couriers, setCouriers] = useState<Courier[]>([])
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [tried, setTried] = useState(false)
  useEffect(() => { if (target === "shipped" && method === "courier") api.couriers().then(setCouriers).catch(() => setCouriers([])) }, [api, target, method])
  const problem = missing(target, method, d)
  async function submit(e: FormEvent) {
    e.preventDefault(); setTried(true); setError("")
    if (problem) return
    setBusy(true)
    try { onDone(await api.move(orderId, target, d, csrf)) } catch (err) { setError(err instanceof Error ? err.message : "No se pudo actualizar la entrega") } finally { setBusy(false) }
  }
  const set = (k: keyof MoveDetails, v: string | null) => setD(x => ({ ...x, [k]: v }))
  return <form onSubmit={submit} className="glass-subpanel" noValidate>
    {error && <p role="alert" className="glass-alert">{error}</p>}
    {target === "shipped" && method === "carrier" && <div className="grid gap-4 sm:grid-cols-2">
      <label className="glass-label">Transportadora<input className="glass-field" list={listId} value={d.carrier} onChange={e => set("carrier", e.target.value)} placeholder="Ej. Servientrega" autoFocus /><datalist id={listId}>{CARRIERS.map(c => <option key={c} value={c} />)}</datalist></label>
      <label className="glass-label">Número de guía<input className="glass-field" value={d.trackingCode} onChange={e => set("trackingCode", e.target.value)} inputMode="text" autoComplete="off" /></label>
    </div>}
    {target === "shipped" && method === "courier" && <div className="grid gap-4 sm:grid-cols-2">
      <label className="glass-label">¿Quién lo lleva?<select className="glass-field" value={d.courierUserId ?? ""} onChange={e => setD(x => ({ ...x, courierUserId: e.target.value || null, courierName: e.target.value ? "" : x.courierName }))} autoFocus>
        <option value="">Otra persona…</option>{couriers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      {!d.courierUserId && <label className="glass-label">Nombre del mensajero<input className="glass-field" value={d.courierName} onChange={e => set("courierName", e.target.value)} placeholder="Ej. Carlos (domiciliario)" /></label>}
    </div>}
    {target === "delivered" && <label className="glass-label">¿Quién lo recibió? (opcional)<input className="glass-field" value={d.recipientName} onChange={e => set("recipientName", e.target.value)} placeholder="Ej. la clienta, portería" autoFocus /></label>}
    {target === "failed" && <div className="grid gap-2"><label className="glass-label">Motivo<input className="glass-field" value={d.reason} onChange={e => set("reason", e.target.value)} placeholder="Qué pasó" autoFocus /></label>
      <div className="glass-presets" role="group" aria-label="Motivos frecuentes">{FAIL_REASONS.map(r => <button key={r} type="button" className="glass-preset" aria-pressed={d.reason === r} onClick={() => set("reason", r)}>{r}</button>)}</div></div>}
    <label className="glass-label">Nota (opcional)<input className="glass-field" value={d.note} onChange={e => set("note", e.target.value)} placeholder="Queda en el historial del envío" /></label>
    {tried && problem && <p className="glass-field-error">{problem}</p>}
    <div className="flex flex-wrap justify-end gap-2"><button type="button" className="glass-chip" disabled={busy} onClick={onCancel}>Cancelar</button><button className={target === "failed" ? "glass-chip glass-chip-danger" : "glass-cta"} disabled={busy}>{busy ? "Guardando…" : STEP_ACTION[target](method)}</button></div>
  </form>
}

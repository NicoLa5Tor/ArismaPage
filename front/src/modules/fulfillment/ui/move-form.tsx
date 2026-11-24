"use client"

import { useEffect, useState, type FormEvent } from "react"
import { ArrowSquareOut, Broadcast, LinkSimple } from "@phosphor-icons/react"
import { missing, type Courier, type DeliveryMethod, type DeliveryStatus, type MoveDetails, type Shipment, type TrackingStatus } from "../domain/fulfillment"
import { linkFor, normalizeNumber, numberError, type CarrierInfo } from "../../shared/domain/carriers"
import { useSession } from "../../shared/ui/admin-context"
import { STEP_ACTION } from "./labels"
import { useFulfillmentPort } from "./use-fulfillment"

const FAIL_REASONS = ["No había nadie", "Dirección incorrecta", "El cliente no respondió", "El cliente lo rechazó"]
const OTHER = "__otra"

/**
 * Sending with a guide, step by step: the carrier (from the store's list, or another one), the number, and how the
 * shopper follows it: automatically (17TRACK) or with the carrier's link. A preview shows the link the shopper gets.
 */
function CarrierFields({ d, setD, tried, current }: { d: MoveDetails; setD: (fn: (x: MoveDetails) => MoveDetails) => void; tried: boolean; current?: Partial<Shipment> }) {
  const api = useFulfillmentPort()
  const [carriers, setCarriers] = useState<CarrierInfo[] | null>(null)
  const [tracking, setTracking] = useState<TrackingStatus | null>(null)
  useEffect(() => {
    let live = true
    api.carriers().then(list => {
      if (!live) return
      const active = list.filter(c => c.active)
      setCarriers(active)
      // a guide being corrected keeps its carrier selected
      const known = active.find(c => c.code === current?.carrierCode) ?? active.find(c => c.name.toLowerCase() === (current?.carrier ?? "").trim().toLowerCase())
      setD(x => ({ ...x, carrierCode: x.carrierCode ?? known?.code ?? (current?.carrier ? OTHER : null) }))
    }).catch(() => { if (live) setCarriers([]) })
    api.trackingStatus().then(s => { if (live) setTracking(s) }).catch(() => { if (live) setTracking(null) })
    return () => { live = false }
  }, [api, current?.carrier, current?.carrierCode, setD])

  const other = d.carrierCode === OTHER
  const chosen = carriers?.find(c => c.code === d.carrierCode) ?? null
  const canFollow = Boolean(tracking?.enabled && tracking.ready && tracking.remaining > 0)
  const followWhy = !tracking ? "" : !tracking.ready ? "El servidor aún no tiene la llave de 17TRACK." : !tracking.enabled ? "El seguimiento automático está apagado (Tienda → Envíos)." : tracking.remaining <= 0 ? `Ya se usaron los ${tracking.limit} envíos con seguimiento de este mes.` : `Quedan ${tracking.remaining} de ${tracking.limit} este mes.`
  const follow = canFollow && d.follow !== false
  const number = normalizeNumber(d.trackingCode ?? "")
  const numberProblem = numberError(d.trackingCode ?? "")
  const link = chosen && !numberProblem ? linkFor(chosen, number) : null

  // without automatic tracking available, the guide goes with its link
  useEffect(() => { if (tracking && !canFollow && d.follow !== false) setD(x => ({ ...x, follow: false })) }, [tracking, canFollow, d.follow, setD])

  return <div className="grid gap-4">
    <fieldset className="ship-carriers"><legend className="glass-label">Transportadora</legend>
      {!carriers ? <p className="text-sm text-stone-500" role="status">Cargando transportadoras…</p> : <div className="ship-carrier-grid">
        {carriers.map(c => <button key={c.code} type="button" className="ship-carrier" aria-pressed={d.carrierCode === c.code} onClick={() => setD(x => ({ ...x, carrierCode: c.code, carrier: c.name }))}>{c.name}</button>)}
        <button type="button" className="ship-carrier" aria-pressed={other} onClick={() => setD(x => ({ ...x, carrierCode: OTHER, carrier: "" }))}>Otra</button>
      </div>}
      {other && <label className="glass-label mt-2">Nombre de la transportadora<input className="glass-field" value={d.carrier ?? ""} onChange={e => setD(x => ({ ...x, carrier: e.target.value }))} placeholder="Ej. Mensajería del barrio" autoFocus /></label>}
    </fieldset>

    <label className="glass-label">Número de guía
      <input className="glass-field ship-number" value={d.trackingCode ?? ""} onChange={e => setD(x => ({ ...x, trackingCode: e.target.value }))} onBlur={() => setD(x => ({ ...x, trackingCode: normalizeNumber(x.trackingCode ?? "") }))}
        inputMode="text" autoComplete="off" spellCheck={false} aria-invalid={tried && Boolean(numberProblem)} placeholder={chosen?.numberHint || "Como aparece en la guía"} />
      {chosen?.numberHint && <span className="text-xs text-stone-500">{chosen.numberHint}</span>}
    </label>

    <fieldset className="grid gap-2"><legend className="glass-label">¿Cómo lo sigue el cliente?</legend>
      <div className="ship-follow" role="radiogroup">
        <label className="ship-follow-option" data-checked={follow || undefined} data-disabled={!canFollow || undefined}>
          <input type="radio" name="follow" className="sr-only" checked={follow} disabled={!canFollow} onChange={() => setD(x => ({ ...x, follow: true }))} />
          <Broadcast size={20} aria-hidden="true" />
          <span><strong>Seguimiento automático</strong><small>La tienda consulta la guía con 17TRACK, le muestra al cliente cada movimiento y marca el pedido entregado cuando llegue. {followWhy}</small></span>
        </label>
        <label className="ship-follow-option" data-checked={!follow || undefined}>
          <input type="radio" name="follow" className="sr-only" checked={!follow} onChange={() => setD(x => ({ ...x, follow: false }))} />
          <LinkSimple size={20} aria-hidden="true" />
          <span><strong>Solo el enlace de la transportadora</strong><small>El cliente recibe el enlace para rastrear la guía en la página de la transportadora. No gasta cupo.</small></span>
        </label>
      </div>
    </fieldset>

    {chosen && <div className="ship-preview" aria-live="polite">
      <span className="text-xs text-stone-400">Así lo ve el cliente</span>
      {numberProblem ? <span className="text-sm text-stone-400">Escribe el número de guía para ver el enlace.</span>
        : <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm">Ver en <strong>{chosen.name}</strong> · guía <strong>{number}</strong></span>
          {link && <a className="glass-chip" href={link} target="_blank" rel="noopener noreferrer"><ArrowSquareOut size={14} aria-hidden="true" />Probar enlace</a>}
          {!chosen.linkTemplate && <span className="text-xs text-stone-500">La página de {chosen.name} no recibe el número en el enlace: el cliente lo copia de su pedido.</span>}
        </div>}
    </div>}
  </div>
}

/** Asks only what the chosen step needs, then moves the delivery. */
export function MoveForm({ orderId, method, target, current, onDone, onCancel }: { orderId: string; method: DeliveryMethod; target: DeliveryStatus; current?: Partial<Shipment>; onDone: (s: Shipment) => void; onCancel: () => void }) {
  const api = useFulfillmentPort()
  const { csrf } = useSession()
  const [d, setD] = useState<MoveDetails>({ carrier: current?.carrier ?? "", trackingCode: current?.trackingCode ?? "", courierUserId: current?.courierUserId ?? null, courierName: "", recipientName: "", reason: "", note: "", carrierCode: null, follow: current?.follow ?? true })
  const [couriers, setCouriers] = useState<Courier[]>([])
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [tried, setTried] = useState(false)
  useEffect(() => { if (target === "shipped" && method === "courier") api.couriers().then(setCouriers).catch(() => setCouriers([])) }, [api, target, method])
  const sending = { ...d, carrierCode: d.carrierCode === OTHER ? null : d.carrierCode, trackingCode: d.trackingCode ? normalizeNumber(d.trackingCode) : d.trackingCode }
  const problem = missing(target, method, sending)
  async function submit(e: FormEvent) {
    e.preventDefault(); setTried(true); setError("")
    if (problem) return
    setBusy(true)
    try { onDone(await api.move(orderId, target, sending, csrf)) } catch (err) { setError(err instanceof Error ? err.message : "No se pudo actualizar la entrega") } finally { setBusy(false) }
  }
  const set = (k: keyof MoveDetails, v: string | null) => setD(x => ({ ...x, [k]: v }))
  return <form onSubmit={submit} className="glass-subpanel" noValidate>
    {error && <p role="alert" className="glass-alert">{error}</p>}
    {target === "shipped" && method === "carrier" && <CarrierFields d={d} setD={setD} tried={tried} current={current} />}
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

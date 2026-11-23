"use client"

import { useState } from "react"
import { ArrowSquareOut, ArrowsClockwise, MapTrifold } from "@phosphor-icons/react"
import { matchCarrier, trackingStages } from "../../shared/domain/carriers"
import type { Shipment, TrackingStatus } from "../domain/fulfillment"
import { dateTime } from "../../shared/ui/format"
import { Async, Card, useLoad } from "../../shared/ui/parts"
import { Switch } from "../../shared/ui/rich"
import { useCan, useSession } from "../../shared/ui/admin-context"
import { useFulfillmentPort } from "./use-fulfillment"

const message = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback)

/**
 * What the carrier says about a shipment on its way: the stage, its movements and a link to the carrier's page.
 * "Actualizar" asks the carrier now (and starts following the guide if the round had not reached it yet).
 */
export function TrackingBlock({ orderId, shipment, onChange }: { orderId: string; shipment: Shipment; onChange: (s: Shipment) => void }) {
  const api = useFulfillmentPort()
  const { csrf } = useSession()
  const canManage = useCan()("FULFILLMENT_MANAGE")
  const [busy, setBusy] = useState(false), [error, setError] = useState("")
  if (shipment.method !== "carrier" || !shipment.trackingCode) return null
  const carrier = matchCarrier(shipment.carrier)
  const tracking = shipment.tracking
  const stage = tracking?.stage ? trackingStages[tracking.stage] : null
  const live = shipment.status === "shipped" || shipment.status === "failed"
  async function refresh() {
    setBusy(true); setError("")
    try { onChange(await api.refreshTracking(orderId, csrf)) } catch (e) { setError(message(e, "No se pudo consultar la transportadora")) } finally { setBusy(false) }
  }
  return <section className="mt-4 grid gap-2" aria-labelledby={`tracking-${orderId}`}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 id={`tracking-${orderId}`} className="text-sm font-semibold">Seguimiento de la transportadora</h3>
      {stage && <span className="glass-badge" data-tone={stage.tone}>{stage.label}</span>}
    </div>
    {tracking?.state === "rejected" && <p className="glass-alert" role="alert">{tracking.error} Corrige la guía o la transportadora para volver a intentarlo.</p>}
    {!tracking && live && <p className="text-xs text-stone-500">Aún no se sigue esta guía. Si el seguimiento automático está activo, empieza en la próxima ronda (cada media hora), o pulsa Actualizar.</p>}
    {tracking?.checkedAt && <p className="text-xs text-stone-500">Consultado {dateTime(tracking.checkedAt)}</p>}
    {tracking && tracking.events.length > 0 && <ol className="glass-timeline">
      {tracking.events.map((e, i) => <li key={`${e.at}-${i}`} data-kind={i === 0 ? "delivery" : undefined}><time dateTime={e.at}>{dateTime(e.at)}{e.location ? ` · ${e.location}` : ""}</time>{e.description}</li>)}
    </ol>}
    {tracking && tracking.state !== "rejected" && tracking.events.length === 0 && <p className="text-xs text-stone-500">La transportadora todavía no publica movimientos.</p>}
    {error && <p role="alert" className="glass-field-error">{error}</p>}
    <div className="flex flex-wrap gap-2">
      {canManage && live && <button type="button" className="glass-chip" disabled={busy} onClick={() => void refresh()}><ArrowsClockwise size={14} aria-hidden="true" className={busy ? "spin" : undefined} /> {busy ? "Consultando…" : "Actualizar"}</button>}
      {carrier && <a className="glass-chip" href={carrier.trackingPage} target="_blank" rel="noopener noreferrer"><ArrowSquareOut size={14} aria-hidden="true" /> Abrir {carrier.label}</a>}
    </div>
  </section>
}

/** Ajustes, Envíos: the administrator decides whether the store follows guides by itself, and sees the month's use. */
export function TrackingSettingsCard() {
  const api = useFulfillmentPort()
  const state = useLoad(() => api.trackingStatus(), [])
  return <Card icon={MapTrifold} title="Seguimiento automático de envíos" subtitle="La tienda consulta a la transportadora y muestra cada paso al cliente en su pedido">
    <Async state={state} label="Cargando seguimiento" rows={2}>{(data: TrackingStatus) => <TrackingSettingsForm initial={data} />}</Async>
  </Card>
}

function TrackingSettingsForm({ initial }: { initial: TrackingStatus }) {
  const api = useFulfillmentPort()
  const { csrf, notify } = useSession()
  const [status, setStatus] = useState(initial), [busy, setBusy] = useState(false), [error, setError] = useState("")
  async function toggle(on: boolean) {
    setBusy(true); setError("")
    try { setStatus(await api.setTracking(on, csrf)); notify(on ? "Seguimiento automático activado." : "Seguimiento automático apagado.") }
    catch (e) { setError(message(e, "No se pudo guardar")) } finally { setBusy(false) }
  }
  const share = status.limit === 0 ? 0 : Math.min(100, Math.round((status.used / status.limit) * 100))
  const month = new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${status.month}-15T00:00:00Z`))
  return <div className="mt-4 grid gap-4">
    {error && <p role="alert" className="glass-alert">{error}</p>}
    {!status.ready && <p className="glass-alert" role="status">El servidor todavía no tiene la llave del servicio de seguimiento. Pide a quien administra la tienda que la configure; mientras tanto, el cliente ve la guía y el enlace a la transportadora.</p>}
    <Switch title="Seguir las guías automáticamente" hint="Al despachar con transportadora, la guía se consulta cada pocas horas. Cuando la transportadora confirma la entrega, el pedido se marca entregado solo." checked={status.enabled} disabled={busy || !status.ready} onChange={v => void toggle(v)} />
    <div className="glass-meter" aria-label="Uso del mes">
      <div><span>Plan {status.planLabel}</span><i role="progressbar" aria-valuemin={0} aria-valuemax={status.limit} aria-valuenow={status.used} aria-label={`${status.used} de ${status.limit} envíos`}><b style={{ width: `${share}%` }} /></i><span>{status.used} de {status.limit}</span></div>
    </div>
    <p className="text-xs text-stone-500">Envíos con seguimiento en {month}: cada guía cuenta una sola vez. Quedan {status.remaining}. Cuando se acaban, los pedidos siguen mostrando la guía y el enlace a la transportadora.</p>
    {status.plan === "free" && <p className="text-sm">El plan Gratis incluye 10 envíos al mes. El plan Plus, de 5 USD al mes, sube a 50. Para activarlo, escríbele a quien administra tu tienda.</p>}
  </div>
}

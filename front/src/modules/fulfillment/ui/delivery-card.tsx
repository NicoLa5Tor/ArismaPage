"use client"

import { useState } from "react"
import { Check, MapPin, Storefront, Truck } from "@phosphor-icons/react"
import { isOpen, type DeliveryMethod, type Shipment } from "../domain/fulfillment"
import { dateTime } from "../../shared/ui/format"
import { CopyButton, Panel, Row, Segmented } from "../../shared/ui/rich"
import { useCan, useSession } from "../../shared/ui/admin-context"
import { METHOD } from "./labels"
import { TrackingBlock } from "./tracking"
import { useFulfillmentPort } from "./use-fulfillment"
import { useStoreProfile } from "../../shared/ui/store-profile"

/** Where the order goes: who receives it, the address and a phone to call on the way. */
export type Destination = { name: string | null; lines: string[]; phone: string | null }

/**
 * How an order leaves and where it goes: the destination first, then the method (it can still change until the order
 * leaves), the carrier or courier with the tracking number, the dates of each step and the carrier's own tracking.
 * The steps themselves are the order's next-step buttons.
 */
export function DeliveryCard({ orderId, shipment, destination, onChange }: { orderId: string; shipment: Shipment | null; destination: Destination; onChange: (s: Shipment) => void }) {
  const profile = useStoreProfile()
  const api = useFulfillmentPort()
  const { csrf, changed } = useSession()
  const canManage = useCan()("FULFILLMENT_MANAGE")
  const [busy, setBusy] = useState(false), [error, setError] = useState("")
  async function reroute(method: DeliveryMethod) {
    if (!shipment || method === shipment.method) return
    setBusy(true); setError("")
    try { onChange(await api.reroute(orderId, method, {}, csrf)); changed() } catch (e) { setError(e instanceof Error ? e.message : "No se pudo cambiar el método") } finally { setBusy(false) }
  }
  if (!shipment) return <Panel icon={Truck} title="Envío"><p className="text-sm text-stone-500" role="status">Cargando el envío…</p></Panel>
  const editable = canManage && isOpen(shipment.status) && shipment.status !== "shipped"
  const pickup = shipment.method === "pickup"
  const who = shipment.courier ?? shipment.carrier
  const steps = [
    { label: "Empacado", at: shipment.packedAt },
    ...(pickup ? [] : [{ label: shipment.method === "courier" ? "Salió con el mensajero" : "Entregado a la transportadora", at: shipment.shippedAt }]),
    { label: pickup ? "Recogido" : "Entregado", at: shipment.deliveredAt },
  ]
  return <div className="grid gap-4">
    <div className="orders-destination">
      {pickup ? <Storefront size={28} aria-hidden="true" className="shrink-0" /> : <MapPin size={28} aria-hidden="true" className="shrink-0" />}
      <div className="min-w-0 flex-1">
        <p className="text-sm text-stone-400">{pickup ? "Lo recoge en la tienda" : "Va para"}</p>
        {pickup ? <p className="font-semibold">{profile.pickupLine || "La tienda"}</p> : <>
          {destination.name && <p className="font-semibold">{destination.name}</p>}
          {destination.lines.length ? destination.lines.map(line => <p key={line}>{line}</p>) : <p className="text-stone-400">Sin dirección registrada</p>}
        </>}
        {destination.phone && <p className="mt-1 text-sm text-stone-400">Teléfono {destination.phone}</p>}
      </div>
      {!pickup && destination.lines.length > 0 && <CopyButton value={[destination.name, ...destination.lines, destination.phone].filter(Boolean).join("\n")} label="la dirección para la guía" />}
    </div>

    <Panel icon={Truck} title="Cómo sale">
      {/* the customer chose pickup or delivery (and paid for it); the store only picks who takes it to the address */}
      {editable && !pickup ? <>
        <Segmented label="Quién lo lleva" value={shipment.method} onChange={v => void reroute(v)} options={(["carrier", "courier"] as DeliveryMethod[]).map(m => ({ value: m, label: METHOD[m].label, icon: METHOD[m].icon }))} />
        <p className="mt-2 text-xs text-stone-500">{busy ? "Guardando…" : "El cliente pidió envío a su dirección. Puedes elegir quién lo lleva hasta que el pedido salga."}</p>
      </> : <>
        <p className="font-semibold">{METHOD[shipment.method].label}</p>
        {pickup && <p className="mt-1 text-xs text-stone-500">Lo eligió el cliente al comprar.</p>}
      </>}
      {error && <p role="alert" className="glass-field-error">{error}</p>}
      {(who || shipment.trackingCode) && <dl className="glass-rows mt-2">
        <Row label={shipment.method === "courier" ? "Mensajero" : "Transportadora"}>{who}</Row>
        <Row label="Guía">{shipment.trackingCode && <span className="flex items-center gap-2 font-semibold">{shipment.trackingCode}<CopyButton value={shipment.trackingCode} label="número de guía" /></span>}</Row>
      </dl>}
    </Panel>

    <ol className="orders-ship-steps" aria-label="Fechas del envío">{steps.map(step => <li key={step.label} data-done={step.at ? true : undefined}>
      <span className="glass-step-dot" aria-hidden="true">{step.at ? <Check size={12} /> : null}</span>
      <span className="min-w-0"><span className="block text-sm font-semibold">{step.label}</span><span className="block text-xs text-stone-400">{step.at ? dateTime(step.at) : "Pendiente"}</span></span>
    </li>)}</ol>
    {shipment.status === "failed" && shipment.failureReason && <p className="glass-banner" role="status">No se entregó: {shipment.failureReason}</p>}

    <TrackingBlock orderId={orderId} shipment={shipment} onChange={onChange} />
  </div>
}

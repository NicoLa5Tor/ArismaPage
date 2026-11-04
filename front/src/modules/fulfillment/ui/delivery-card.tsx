"use client"

import { useState } from "react"
import { MapPin, Truck } from "@phosphor-icons/react"
import { isOpen, type DeliveryMethod, type Shipment } from "../domain/fulfillment"
import { dateTime } from "../../shared/ui/format"
import { CopyButton, Panel, Row, Segmented } from "../../shared/ui/rich"
import { useCan, useSession } from "../../shared/ui/admin-context"
import { METHOD } from "./labels"
import { useFulfillmentPort } from "./use-fulfillment"

/**
 * How an order is delivered and what was recorded (carrier, tracking, courier, who received it).
 * The steps themselves are the order's next-step buttons; here the team can still switch the method before it leaves.
 */
export function DeliveryCard({ orderId, shipment, address, onChange }: { orderId: string; shipment: Shipment | null; address?: string; onChange: (s: Shipment) => void }) {
  const api = useFulfillmentPort()
  const { csrf, changed } = useSession()
  const canManage = useCan()("FULFILLMENT_MANAGE")
  const [busy, setBusy] = useState(false), [error, setError] = useState("")
  async function reroute(method: DeliveryMethod) {
    if (!shipment || method === shipment.method) return
    setBusy(true); setError("")
    try { onChange(await api.reroute(orderId, method, {}, csrf)); changed() } catch (e) { setError(e instanceof Error ? e.message : "No se pudo cambiar el método") } finally { setBusy(false) }
  }
  if (!shipment) return <Panel icon={Truck} title="Entrega"><p className="text-sm text-stone-500">Cargando entrega…</p></Panel>
  const editable = canManage && isOpen(shipment.status) && shipment.status !== "shipped"
  return <Panel icon={Truck} title="Entrega">
    {editable ? <Segmented label="Método de entrega" value={shipment.method} onChange={v => void reroute(v)} options={(Object.keys(METHOD) as DeliveryMethod[]).map(m => ({ value: m, label: METHOD[m].label, icon: METHOD[m].icon }))} />
      : <p className="text-sm font-semibold">{METHOD[shipment.method].label}</p>}
    {busy && <p className="text-xs text-stone-500" role="status">Guardando…</p>}
    {error && <p role="alert" className="glass-field-error">{error}</p>}
    <dl className="glass-rows">
      {shipment.method !== "pickup" && <Row label="Dirección">{address && <span className="flex items-start gap-2"><MapPin size={14} aria-hidden="true" className="mt-1 shrink-0" />{address}</span>}</Row>}
      {shipment.method === "pickup" && <Row label="Recoge en">Calle 53 No. 15-24, Bogotá</Row>}
      <Row label="Transportadora">{shipment.carrier}</Row>
      <Row label="Guía">{shipment.trackingCode && <span className="flex items-center gap-2">{shipment.trackingCode}<CopyButton value={shipment.trackingCode} label="número de guía" /></span>}</Row>
      <Row label="Mensajero">{shipment.courier}</Row>
      <Row label="Empacado">{shipment.packedAt && dateTime(shipment.packedAt)}</Row>
      <Row label="Despachado">{shipment.shippedAt && dateTime(shipment.shippedAt)}</Row>
      <Row label="Entregado">{shipment.deliveredAt && `${dateTime(shipment.deliveredAt)}${shipment.recipientName ? ` · recibió ${shipment.recipientName}` : ""}`}</Row>
      <Row label="No entregado">{shipment.status === "failed" && shipment.failureReason}</Row>
    </dl>
  </Panel>
}

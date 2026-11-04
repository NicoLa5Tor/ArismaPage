"use client"

import { useState, type FormEvent } from "react"
import { ArrowSquareOut, ChatCircleText, CreditCard, FileText, Package, Receipt, User } from "@phosphor-icons/react"
import type { Address, OrderDetail } from "../domain/orders"
import { count, date, dateTime, money, plural } from "../../shared/ui/format"
import { Dialog, Empty, Failure, Loading, useLoad } from "../../shared/ui/parts"
import { Avatar, ContactActions, CopyButton, Panel, Row, Stat, TabPanel, Tabs, Thumb } from "../../shared/ui/rich"
import { useCan, useSession } from "../../shared/ui/admin-context"
import { DELIVERY_STATUS } from "../../fulfillment/ui/labels"
import { DeliveryCard } from "../../fulfillment/ui/delivery-card"
import { useFulfillmentPort } from "../../fulfillment/ui/use-fulfillment"
import type { Shipment } from "../../fulfillment/domain/fulfillment"
import { FlowActions } from "./flow-actions"
import { ORDER_STATUS, PAYMENT } from "./labels"
import { Journey, STAGE, StageBadge, stageLabel } from "./stage"
import { useOrdersPort } from "./use-orders"

type Tab = "summary" | "products" | "history"
const DOC: Record<string, string> = { cc: "Cédula", NIT: "NIT", extranjeria: "Cédula de extranjería" }
const addressLine = (a: Address) => [a.address_1, a.address_2, a.city, a.state].filter(Boolean).join(", ")
const fullName = (o: OrderDetail) => o.customer ? [o.customer.firstName, o.customer.lastName].filter(Boolean).join(" ") : [o.billing.first_name, o.billing.last_name].filter(Boolean).join(" ")

/** One order, one journey: where it is, the next step at the bottom, and everything that happened in a single history. */
export function OrderDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const api = useOrdersPort(), fulfillment = useFulfillmentPort()
  const { csrf, openCustomer, openQuote, openProduct, version } = useSession()
  const order = useLoad(() => api.get(id), [id, version])
  const shipment = useLoad(() => fulfillment.shipment(id), [id, version])
  const [localShipment, setLocalShipment] = useState<Shipment | null>(null)
  const canNote = useCan()("ORDERS_MANAGE")
  const [tab, setTab] = useState<Tab>("summary")
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [note, setNote] = useState("")
  const o = order.data, s = localShipment && shipment.data && localShipment.updatedAt >= shipment.data.updatedAt ? localShipment : shipment.data

  async function addNote(e: FormEvent) {
    e.preventDefault(); if (!note.trim()) return
    setBusy(true); setError("")
    try { await api.addNote(id, note, csrf); setNote(""); order.reload() } catch (err) { setError(err instanceof Error ? err.message : "No se pudo guardar la nota") } finally { setBusy(false) }
  }

  const name = o ? fullName(o) || "Cliente sin nombre" : ""
  const units = o ? o.lines.reduce((a, l) => a + l.quantity, 0) : 0
  const history = o ? [
    ...o.history.map(h => ({ id: `o-${h.id}`, at: h.createdAt, kind: "status", text: h.fromStatus ? `Pedido: ${ORDER_STATUS[h.fromStatus]} → ${ORDER_STATUS[h.toStatus]}` : `Pedido: ${ORDER_STATUS[h.toStatus]}`, detail: h.note, who: h.actor })),
    ...(s?.events ?? []).map(e => ({ id: `s-${e.id}`, at: e.createdAt, kind: "delivery", text: e.fromStatus ? `Entrega: ${DELIVERY_STATUS[e.fromStatus]} → ${DELIVERY_STATUS[e.toStatus]}` : `Entrega: ${DELIVERY_STATUS[e.toStatus]}`, detail: e.note, who: e.actor })),
    ...o.notes.map(n => ({ id: `n-${n.id}`, at: n.createdAt, kind: "note", text: n.body, detail: "", who: n.author })),
  ].sort((a, b) => b.at.localeCompare(a.at)) : []
  const footer = o ? <div className="glass-dialog-actions"><span className="text-sm text-stone-500">{STAGE[o.stage].hint}</span>
    <FlowActions variant="footer" target={{ orderId: o.id, number: o.number, stage: o.stage, orderStatus: o.status, deliveryStatus: o.deliveryStatus, deliveryMethod: o.deliveryMethod, paymentMethod: o.paymentMethod, carrier: s?.carrier, trackingCode: s?.trackingCode }} onDone={() => { order.reload(); shipment.reload() }} /></div> : undefined

  return <Dialog eyebrow="Pedido" title={o ? `Pedido #${o.number}` : "Pedido"} size="lg" busy={busy} onClose={onClose} footer={footer}
    media={o ? <Avatar name={name} size={52} /> : undefined}
    meta={o ? <><StageBadge stage={o.stage} method={o.deliveryMethod} /><span>{dateTime(o.placedAt)}</span><span>{name}</span></> : undefined}>
    {order.error ? <Failure message={order.error} onRetry={order.reload} /> : !o ? <Loading label="Cargando pedido" rows={5} /> : <div className="grid gap-6">
      <Journey stage={o.stage} method={o.deliveryMethod} cashOnDelivery={o.paymentMethod === "cod" && !o.paidAt} />
      {o.stage === "issue" && <p className="glass-banner" role="status">{o.status === "on_hold" ? "El pedido está en espera: revisa el pago o la disponibilidad y luego reanúdalo." : s?.failureReason ? `No se entregó: ${s.failureReason}. Reintenta el envío o registra la devolución.` : "Este pedido necesita una revisión."}</p>}
      <div className="glass-stats orders-detail-stats">
        <Stat label="Total" value={money(o.total)} hint={o.taxTotal ? `IVA ${money(o.taxTotal)}` : undefined} />
        <Stat label="Productos" value={plural(units, "unidad", "unidades")} hint={plural(o.lines.length, "referencia", "referencias")} />
        <Stat label="Pago" value={o.paymentMethod ? PAYMENT[o.paymentMethod] ?? o.paymentMethodTitle : "Sin método"} hint={o.paidAt ? `Pagado ${date(o.paidAt)}` : o.paymentMethod === "cod" ? "Se paga al entregar" : "Sin pago registrado"} />
        <Stat label="Etapa" value={stageLabel(o.stage, o.deliveryMethod)} hint={s?.trackingCode ? `${s.carrier} · ${s.trackingCode}` : s?.courier ? `Lleva ${s.courier}` : undefined} />
      </div>
      {error && <p role="alert" className="glass-alert">{error}</p>}
      <Tabs label="Detalle del pedido" value={tab} onChange={setTab} tabs={[{ id: "summary", label: "Resumen" }, { id: "products", label: "Productos", badge: o.lines.length }, { id: "history", label: "Historial", badge: history.length }]} />

      <TabPanel active={tab === "summary"}><div className="glass-panels orders-detail-panels">
        <DeliveryCard orderId={o.id} shipment={s} address={addressLine(o.shipping.address_1 ? o.shipping : o.billing)} onChange={setLocalShipment} />
        <Panel icon={User} title="Cliente" action={o.customer ? <button type="button" className="glass-chip" onClick={() => openCustomer(o.customer!.id)}>Ver ficha</button> : undefined}>
          <dl className="glass-rows"><Row label="Nombre">{name}</Row><Row label="Correo">{o.billing.email ?? o.customer?.email}</Row><Row label="Teléfono">{o.billing.phone ?? o.customer?.phone}</Row>
            <Row label="Documento">{o.billing.id ? `${DOC[o.billing.id_type ?? ""] ?? o.billing.id_type ?? ""} ${o.billing.id}` : null}</Row>
            <Row label="Historial">{o.customer ? `${plural(o.customer.orders, "pedido pagado", "pedidos pagados")} · ${money(o.customer.totalSpent)}` : "Compró como invitado"}</Row></dl>
          <ContactActions email={o.billing.email ?? o.customer?.email} phone={o.billing.phone ?? o.customer?.phone} message={`Hola ${o.billing.first_name ?? ""}, te escribimos de Arisma sobre tu pedido #${o.number}.`} />
        </Panel>
        <Panel icon={CreditCard} title="Pago">
          {o.payments.length === 0 ? <p className="text-sm text-stone-500">{o.paymentMethod ? `${PAYMENT[o.paymentMethod] ?? o.paymentMethodTitle}${o.paymentMethod === "cod" ? ": se paga al entregar." : ", sin transacción registrada."}` : "Sin pago registrado."}</p> :
            o.payments.map(p => <dl key={p.id} className="glass-rows"><Row label="Pasarela">{PAYMENT[p.provider] ?? p.provider}</Row><Row label="Medio">{p.paymentType}</Row>
              <Row label="Transacción">{p.externalId && <span className="flex items-center gap-2"><span className="truncate">{p.externalId}</span><CopyButton value={p.externalId} label="identificador de la transacción" /></span>}</Row><Row label="Fecha">{dateTime(p.paidAt)}</Row></dl>)}
        </Panel>
        <Panel icon={Receipt} title="Totales">
          <div className="glass-totals"><div><span>Subtotal sin IVA</span><span>{money(o.subtotal)}</span></div>{o.discountTotal > 0 && <div><span>Descuentos{o.discounts.length > 0 && ` (${o.discounts.map(d => d.code).join(", ")})`}</span><span>−{money(o.discountTotal)}</span></div>}<div><span>Envío</span><span>{money(o.shippingTotal)}</span></div><div><span>IVA</span><span>{money(o.taxTotal)}</span></div><div><span>Total</span><span>{money(o.total)}</span></div></div>
        </Panel>
        {o.customerNote && <Panel icon={ChatCircleText} title="Nota del cliente"><p className="text-sm">{o.customerNote}</p></Panel>}
        {o.quote && <Panel icon={FileText} title="Origen"><button type="button" className="glass-chip" onClick={() => openQuote(o.quote!.id)}>Viene de la cotización {o.quote.number}</button></Panel>}
      </div></TabPanel>

      <TabPanel active={tab === "products"}>
        {o.lines.length === 0 ? <Empty icon={Package} title="Este pedido no tiene productos" /> : <ul className="glass-lines">{o.lines.map(l => <li key={l.id}>
          <Thumb image={{ productId: l.productId, imageId: l.imageId, imageUrl: l.imageUrl, imageUploaded: l.imageUploaded }} size={56} />
          <div className="min-w-0 flex-1"><p className="font-semibold">{l.productId ? <button type="button" className="glass-row-link" onClick={() => openProduct(l.productId!)}>{l.title}<ArrowSquareOut size={12} aria-hidden="true" className="ml-1 inline" /></button> : l.title}</p>
            <p className="text-xs text-stone-500">{l.sku ?? "Sin SKU"} · {count(l.quantity)} × {money(l.unitPrice)} sin IVA{l.discount > 0 && ` · descuento ${money(l.discount)}`}</p>
            {l.currentTitle && l.currentTitle !== l.title && <p className="text-xs text-stone-500">Hoy se llama “{l.currentTitle}”</p>}{l.productId == null && <p className="text-xs text-stone-500">El producto ya no existe en el catálogo</p>}</div>
          <div className="text-right tabular-nums"><p className="font-semibold">{money(l.total + l.tax)}</p><p className="text-xs text-stone-500">IVA {money(l.tax)}</p></div>
        </li>)}</ul>}
      </TabPanel>

      <TabPanel active={tab === "history"}><div className="grid gap-4">
        {canNote && <form onSubmit={addNote} className="glass-composer"><label className="sr-only" htmlFor={`note-${id}`}>Nueva nota interna</label><textarea id={`note-${id}`} className="glass-field" rows={2} maxLength={4000} value={note} onChange={e => setNote(e.target.value)} placeholder="Nota interna, por ejemplo: el cliente pidió entregar después de las 3 p. m." /><button className="glass-cta" disabled={busy || !note.trim()}>Agregar nota</button></form>}
        {shipment.loading && !s && <p className="text-xs text-stone-500" role="status">Cargando historial de entrega…</p>}
        <ol className="glass-timeline">{history.map(e => <li key={e.id} data-kind={e.kind}><time dateTime={e.at}>{dateTime(e.at)}{e.who && ` · ${e.who}`}</time>{e.text}{e.detail && <span className="block text-xs text-stone-500">{e.detail}</span>}</li>)}</ol>
      </div></TabPanel>
    </div>}
  </Dialog>
}

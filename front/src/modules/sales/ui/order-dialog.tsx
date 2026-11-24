"use client"

import { useEffect, useRef, useState, type FormEvent } from "react"
import { FileText, Flask, Receipt, Storefront, User } from "@phosphor-icons/react"
import type { Address, OrderDetail } from "../domain/orders"
import { currentPhase, type Phase } from "../domain/phases"
import { dateTime, money, plural } from "../../shared/ui/format"
import { Badge, Dialog, Failure, Loading, useLoad } from "../../shared/ui/parts"
import { Avatar, ContactActions, Panel, Row, TabPanel, Tabs } from "../../shared/ui/rich"
import { useCan, useSession } from "../../shared/ui/admin-context"
import { DELIVERY_STATUS } from "../../fulfillment/ui/labels"
import { DeliveryCard } from "../../fulfillment/ui/delivery-card"
import { useFulfillmentPort } from "../../fulfillment/ui/use-fulfillment"
import type { Shipment } from "../../fulfillment/domain/fulfillment"
import { FlowActions } from "./flow-actions"
import { ORDER_STATUS } from "./labels"
import { STAGE, StageBadge } from "./stage"
import { useOrdersPort } from "./use-orders"
import { useStoreProfile } from "../../shared/ui/store-profile"
import { InvoiceDialog } from "./invoice-dialog"
import { departmentName } from "../../shared/domain/colombia"
import { DeliverPhase, InvoicePhase, PayPhase, PhaseIntro, PhaseSteps, PreparePhase } from "./order-phases"
import { AfterSalePanel } from "./after-sale"

type Tab = "order" | "history"
const DOC: Record<string, string> = { cc: "Cédula", NIT: "NIT", extranjeria: "Cédula de extranjería" }
/** Who receives the order and where: the shipping address, or the billing one when no other was given. */
const destinationOf = (o: OrderDetail) => {
  const a: Address = o.shipping.address_1 ? o.shipping : o.billing
  const extra = a as Address & { neighborhood?: string; instructions?: string }
  return {
    name: [a.first_name, a.last_name].filter(Boolean).join(" ") || null,
    lines: [[a.address_1, a.address_2].filter(Boolean).join(", "), [extra.neighborhood, a.city, departmentName(a.state)].filter(Boolean).join(", "), extra.instructions ? `Indicaciones: ${extra.instructions}` : ""].filter(Boolean),
    phone: a.phone ?? o.billing.phone ?? null,
  }
}
const fullName = (o: OrderDetail) => o.customer ? [o.customer.firstName, o.customer.lastName].filter(Boolean).join(" ") : [o.billing.first_name, o.billing.last_name].filter(Boolean).join(" ")

/**
 * One order, by phases: payment → preparation → shipping → delivery → invoice. The phase it is in opens first, the
 * others are a click away; the customer and the total stay on the side, and the next step is at the bottom.
 */
export function OrderDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const profile = useStoreProfile()
  const api = useOrdersPort(), fulfillment = useFulfillmentPort()
  const { csrf, openCustomer, openQuote, openProduct, version, notify, changed } = useSession()
  const order = useLoad(() => api.get(id), [id, version])
  const shipment = useLoad(() => fulfillment.shipment(id), [id, version])
  const [localShipment, setLocalShipment] = useState<Shipment | null>(null)
  const canManage = useCan()("ORDERS_MANAGE")
  const [tab, setTab] = useState<Tab>("order")
  // null follows the order: after a step it shows the new phase
  const [picked, setPicked] = useState<Phase | null>(null)
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [note, setNote] = useState("")
  const [invoicing, setInvoicing] = useState(false)
  const o = order.data, s = localShipment && shipment.data && localShipment.updatedAt >= shipment.data.updatedAt ? localShipment : shipment.data

  async function addNote(e: FormEvent) {
    e.preventDefault(); if (!note.trim()) return
    setBusy(true); setError("")
    try { await api.addNote(id, note, csrf); setNote(""); order.reload() } catch (err) { setError(err instanceof Error ? err.message : "No se pudo guardar la nota") } finally { setBusy(false) }
  }

  // a Wompi payment can arrive without notice (the shopper closed the page): opening the order asks Wompi, once
  const checked = useRef(false)
  useEffect(() => {
    if (!o || checked.current) return
    checked.current = true
    const open = o.status === "pending" && (o.attempts ?? []).some(a => a.gateway === "wompi" && (a.status === "started" || a.status === "pending"))
    if (!open) return
    api.checkPayment(id, csrf).then(status => { if (status === "approved") { notify(`Wompi confirmó el pago del pedido #${o.number}.`); changed(); order.reload() } }).catch(() => { /* the order shows what is known */ })
  }, [o, api, id, csrf, notify, changed, order])

  async function keepActive(active: boolean) {
    setBusy(true); setError("")
    try { await api.keepActive(id, active, csrf); notify(active ? `Pedido #${o?.number} de vuelta en Pedidos.` : `Pedido #${o?.number} enviado al historial.`); changed(); order.reload() }
    catch (err) { setError(err instanceof Error ? err.message : "No se pudo mover el pedido") } finally { setBusy(false) }
  }

  async function registerPayment(reference: string) {
    setError("")
    try { await api.registerPayment(id, reference, csrf); notify(`Pago registrado en el pedido #${o?.number}.`); setPicked(null); changed(); order.reload() }
    catch (err) { setError(err instanceof Error ? err.message : "No se pudo registrar el pago") }
  }
  const name = o ? fullName(o) || "Cliente sin nombre" : ""
  const history = o ? [
    // an event that did not change the status (an invoice sent, for example) reads as what happened
    ...o.history.map(h => h.fromStatus === h.toStatus && h.note
      ? { id: `o-${h.id}`, at: h.createdAt, kind: "status", text: h.note, detail: "", who: h.actor }
      : { id: `o-${h.id}`, at: h.createdAt, kind: "status", text: h.fromStatus ? `Pedido: ${ORDER_STATUS[h.fromStatus]} → ${ORDER_STATUS[h.toStatus]}` : `Pedido: ${ORDER_STATUS[h.toStatus]}`, detail: h.note, who: h.actor }),
    ...(s?.events ?? []).map(e => ({ id: `s-${e.id}`, at: e.createdAt, kind: "delivery", text: e.fromStatus ? `Entrega: ${DELIVERY_STATUS[e.fromStatus]} → ${DELIVERY_STATUS[e.toStatus]}` : `Entrega: ${DELIVERY_STATUS[e.toStatus]}`, detail: e.note, who: e.actor })),
    ...o.notes.map(n => ({ id: `n-${n.id}`, at: n.createdAt, kind: "note", text: n.body, detail: "", who: n.author })),
  ].sort((a, b) => b.at.localeCompare(a.at)) : []
  const shown: Phase = picked ?? (o ? currentPhase(o.stage, o.deliveryStatus, o.deliveryMethod) : "pay")
  const footer = o ? <div className="glass-dialog-actions"><span className="text-sm text-stone-500">{STAGE[o.stage].hint}</span>
    <FlowActions variant="footer" target={{ orderId: o.id, number: o.number, stage: o.stage, orderStatus: o.status, deliveryStatus: o.deliveryStatus, deliveryMethod: o.deliveryMethod, paymentMethod: o.paymentMethod, carrier: s?.carrier, trackingCode: s?.trackingCode }} onDone={() => { setPicked(null); order.reload(); shipment.reload() }} /></div> : undefined

  return <Dialog eyebrow="Pedido" title={o ? `Pedido #${o.number}` : "Pedido"} size="full" busy={busy} onClose={onClose} footer={footer}
    media={o ? <Avatar name={name} size={52} /> : undefined}
    meta={o ? <><StageBadge stage={o.stage} method={o.deliveryMethod} />{o.test && <Badge tone="warn"><Flask size={12} aria-hidden="true" className="mr-1 inline" />Prueba</Badge>}{o.createdVia === "storefront" && <Badge tone="info"><Storefront size={12} aria-hidden="true" className="mr-1 inline" />Tienda</Badge>}<span className="font-semibold tabular-nums">{money(o.total)}</span><span>{dateTime(o.placedAt)}</span><span>{name}</span></> : undefined}>
    {order.error ? <Failure message={order.error} onRetry={order.reload} /> : !o ? <Loading label="Cargando pedido" rows={5} /> : <div className="grid gap-6">
      {o.stage === "issue" && <p className="glass-banner" role="status">{o.status === "on_hold" ? "El pedido está en espera: revisa el pago o la disponibilidad y luego reanúdalo." : s?.failureReason ? `No se entregó: ${s.failureReason}. Reintenta el envío o registra la devolución.` : "Este pedido necesita una revisión."}</p>}
      {o.stage === "cancelled" && <p className="glass-banner" role="status"><StageBadge stage="cancelled" />Este pedido ya no sigue el recorrido de entrega.</p>}
      {o.migrated && o.stage !== "delivered" && o.stage !== "cancelled" && <div className="glass-banner orders-history-banner" role="status">
        <span>{o.keptActive ? "Este pedido viene de la tienda anterior y lo trajiste a la lista de pedidos." : "Este pedido viene de la tienda anterior: está en el Historial y no aparece en el trabajo del día."}</span>
        {canManage && <button type="button" className="glass-chip" disabled={busy} onClick={() => void keepActive(!o.keptActive)}>{o.keptActive ? "Enviar al historial" : "Traer a Pedidos"}</button>}
      </div>}
      {error && <p role="alert" className="glass-alert">{error}</p>}
      {(o.cancellations ?? []).some(r => r.status === "requested") && <p className="glass-banner" role="status">El cliente pidió cancelar este pedido. Respóndele en «Cancelación y reembolsos».</p>}
      <div className="orders-detail-tabs"><Tabs label="Detalle del pedido" value={tab} onChange={setTab} tabs={[{ id: "order", label: "Pedido" }, { id: "history", label: "Historial", badge: history.length }]} /></div>

      <TabPanel active={tab === "order"}><div className="grid gap-6">
        <PhaseSteps order={o} shown={shown} onShow={setPicked} />
        <div className="orders-phase-layout">
          <div className="orders-phase" aria-live="polite">
            <PhaseIntro phase={shown} order={o} shipment={s} />
            {shown === "pay" && <PayPhase order={o} canManage={canManage} onRegister={registerPayment} />}
            {shown === "prepare" && <PreparePhase order={o} onProduct={openProduct} />}
            {shown === "deliver" && <DeliverPhase order={o} shipment={s} />}
            {shown === "ship" && <DeliveryCard orderId={o.id} shipment={s} destination={destinationOf(o)} onChange={setLocalShipment} />}
            {shown === "invoice" && <InvoicePhase order={o} canManage={canManage} fileUrl={api.invoiceFileUrl(o.id)} onOpen={() => setInvoicing(true)} />}
          </div>
          <aside className="orders-phase-aside" aria-label="Cliente y total">
            <Panel icon={User} title="Cliente" action={o.customer ? <button type="button" className="glass-chip" onClick={() => openCustomer(o.customer!.id)}>Ver ficha</button> : undefined}>
              <dl className="glass-rows"><Row label="Nombre">{name}</Row><Row label="Correo">{o.billing.email ?? o.customer?.email}</Row><Row label="Teléfono">{o.billing.phone ?? o.customer?.phone}</Row>
                <Row label="Documento">{o.billing.id ? `${DOC[o.billing.id_type ?? ""] ?? o.billing.id_type ?? ""} ${o.billing.id}` : null}</Row>
                <Row label="Historial">{o.customer ? `${plural(o.customer.orders, "pedido pagado", "pedidos pagados")} · ${money(o.customer.totalSpent)}${o.test ? " (los de prueba no cuentan)" : ""}` : "Compró como invitado"}</Row></dl>
              <ContactActions email={o.billing.email ?? o.customer?.email} phone={o.billing.phone ?? o.customer?.phone} message={`Hola ${o.billing.first_name ?? ""}, te escribimos de ${profile.shortName} sobre tu pedido #${o.number}.`} />
            </Panel>
            <Panel icon={Receipt} title="Total">
              <p className="orders-total"><span className="tabular-nums">{money(o.total)}</span>{o.paidAt ? <Badge tone="good">Pagado</Badge> : o.paymentMethod === "cod" ? <Badge tone="info">Al entregar</Badge> : <Badge tone="warn">Sin pagar</Badge>}</p>
              <details className="orders-older"><summary>Ver el detalle</summary>
                <div className="glass-totals mt-2"><div><span>Subtotal sin IVA</span><span>{money(o.subtotal)}</span></div>{o.discountTotal > 0 && <div><span>Descuentos{o.discounts.length > 0 && ` (${o.discounts.map(d => d.code).join(", ")})`}</span><span>−{money(o.discountTotal)}</span></div>}<div><span>Envío</span><span>{money(o.shippingTotal)}</span></div><div><span>IVA</span><span>{money(o.taxTotal)}</span></div><div><span>Total</span><span>{money(o.total)}</span></div></div>
              </details>
            </Panel>
            <AfterSalePanel order={o} canManage={canManage} onChanged={() => { setPicked(null); order.reload() }} />
            {o.quote && <Panel icon={FileText} title="Origen"><button type="button" className="glass-chip" onClick={() => openQuote(o.quote!.id)}>Viene de la cotización {o.quote.number}</button></Panel>}
          </aside>
        </div>
      </div></TabPanel>

      <TabPanel active={tab === "history"}><div className="grid gap-4">
        {canManage && <form onSubmit={addNote} className="glass-composer"><label className="sr-only" htmlFor={`note-${id}`}>Nueva nota interna</label><textarea id={`note-${id}`} className="glass-field" rows={2} maxLength={4000} value={note} onChange={e => setNote(e.target.value)} placeholder="Nota interna, por ejemplo: el cliente pidió entregar después de las 3 p. m." /><button className="glass-cta" disabled={busy || !note.trim()}>Agregar nota</button></form>}
        {shipment.loading && !s && <p className="text-xs text-stone-500" role="status">Cargando historial de entrega…</p>}
        <ol className="glass-timeline">{history.map(e => <li key={e.id} data-kind={e.kind}><time dateTime={e.at}>{dateTime(e.at)}{e.who && ` · ${e.who}`}</time>{e.text}{e.detail && <span className="block text-xs text-stone-500">{e.detail}</span>}</li>)}</ol>
      </div></TabPanel>
    </div>}
    {invoicing && <InvoiceDialog orderId={id} onClose={() => setInvoicing(false)} onSent={() => { setInvoicing(false); setPicked(null); changed(); order.reload() }} />}
  </Dialog>
}

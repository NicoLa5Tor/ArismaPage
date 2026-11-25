"use client"

import { useState, type FormEvent } from "react"
import { ArrowSquareOut, ChatCircleText, Check, CreditCard, EnvelopeSimple, FilePdf, FileText, HandArrowDown, Package, PaperPlaneTilt, WhatsappLogo } from "@phosphor-icons/react"
import type { OrderDetail } from "../domain/orders"
import { type Phase, type PhaseState, phaseState, phasesFor } from "../domain/phases"
import type { Shipment } from "../../fulfillment/domain/fulfillment"
import { channelLabel } from "../domain/invoice"
import { count, dateTime, money } from "../../shared/ui/format"
import { Badge, Empty } from "../../shared/ui/parts"
import { CopyButton, Panel, Row, Thumb } from "../../shared/ui/rich"
import { DeliveryBadge, MethodLabel } from "../../fulfillment/ui/labels"
import { PAYMENT } from "./labels"

const ATTEMPT: Record<string, string> = { started: "Iniciado", pending: "En proceso", approved: "Aprobado", declined: "Rechazado", voided: "Anulado o vencido", error: "Error" }
const STATE_TEXT: Record<PhaseState, string> = { done: "hecho", current: "en curso", todo: "pendiente", bad: "requiere atención" }
const STATE_BADGE: Record<PhaseState, { label: string; tone: "good" | "info" | "neutral" | "bad" }> = { done: { label: "Hecho", tone: "good" }, current: { label: "En curso", tone: "info" }, todo: { label: "Pendiente", tone: "neutral" }, bad: { label: "Requiere atención", tone: "bad" } }
const TITLE: Record<Phase, string> = { pay: "Pago", prepare: "Preparación", ship: "Envío", deliver: "Entrega", invoice: "Factura" }
const when = (at: string | null | undefined) => at ? ` el ${dateTime(at)}` : ""

/** One sentence per phase: what happened, or what is missing to move on. */
function phaseText(phase: Phase, state: PhaseState, o: OrderDetail, s: Shipment | null): string {
  const pickup = o.deliveryMethod === "pickup"
  const units = o.lines.reduce((a, l) => a + l.quantity, 0)
  if (o.stage === "cancelled" && phase === "pay" && o.unpaidExpiredAt && !o.paidAt) return "Se canceló porque no se pagó a tiempo. Si el cliente pagó por transferencia, regístralo aquí y el pedido vuelve a quedar activo."
  if (o.stage === "cancelled") return "El pedido se canceló; esta fase ya no aplica."
  switch (phase) {
    case "pay":
      if (o.paidAt) return `Pagado${when(o.paidAt)} con ${o.paymentMethod ? PAYMENT[o.paymentMethod] ?? o.paymentMethodTitle : "un medio sin registrar"}.`
      if (o.paymentMethod === "cod") return "Se paga al entregar: el pedido sigue su camino y el pago se recibe en la entrega."
      if (o.status === "on_hold") return "El pedido está en espera. Revisa el pago y reanúdalo cuando esté confirmado."
      return "Esperando el pago del cliente. Si pagó por transferencia o en la tienda, regístralo aquí."
    case "prepare":
      if (state === "done") return s?.packedAt ? `Empacado${when(s.packedAt)}.` : "Ya se preparó."
      if (state === "current") return `Alista ${units === 1 ? "la unidad" : `las ${count(units)} unidades`} de abajo y márcalo como empacado.`
      return "Se prepara cuando el pago esté confirmado."
    case "ship":
      if (state === "done") return `Salió${when(s?.shippedAt)}${s?.carrier ? ` con ${s.carrier}` : s?.courier ? ` con ${s.courier}` : ""}${s?.trackingCode ? `, guía ${s.trackingCode}` : ""}.`
      if (state === "current") return o.deliveryMethod === "courier" ? "Entrégaselo al mensajero y registra quién lo lleva." : "Entrégalo a la transportadora y registra el número de guía."
      return "Sale cuando esté empacado."
    case "deliver":
      if (state === "done") return `${pickup ? "Recogido" : "Entregado"}${when(s?.deliveredAt)}${s?.recipientName ? `; lo recibió ${s.recipientName}` : ""}.`
      if (state === "bad") return s?.failureReason ? `No se entregó: ${s.failureReason}.` : "La entrega tuvo un problema."
      if (state === "current") return pickup ? "Está listo para que el cliente lo recoja en la tienda. Márcalo como entregado cuando venga." : "Va en camino. Márcalo como entregado cuando llegue."
      return pickup ? "Se entrega cuando el cliente venga a recogerlo." : "Todavía no ha salido."
    case "invoice": {
      const inv = o.invoice
      if (inv?.status === "not_needed") return "Este pedido no requiere factura."
      if (inv?.status === "sent") return `Enviada por ${channelLabel(inv.channels.split(",").filter(Boolean))}${when(inv.sentAt)}.`
      if (o.stage === "to_invoice") return "Ya se entregó: envía la factura para finalizar el pedido."
      if (inv?.status === "uploaded") return "El PDF está adjunto, falta enviarlo al cliente."
      return "Puedes adjuntarla y enviarla desde que el pedido está pagado; al entregarlo queda finalizado."
    }
  }
}

/** The top of a phase: its name, how it stands and one sentence about what happened or what is next. */
export function PhaseIntro({ phase, order, shipment }: { phase: Phase; order: OrderDetail; shipment: Shipment | null }) {
  const state = phaseState(phase, order.stage, order.deliveryStatus, order.deliveryMethod)
  const title = phase === "deliver" && order.deliveryMethod === "pickup" ? "Recogida" : phase === "pay" && order.paymentMethod === "cod" && !order.paidAt ? "Pago al entregar" : TITLE[phase]
  return <header className="orders-phase-intro">
    <div className="flex flex-wrap items-center gap-2"><h3>{title}</h3><Badge tone={STATE_BADGE[state].tone}>{STATE_BADGE[state].label}</Badge></div>
    <p>{phaseText(phase, state, order, shipment)}</p>
  </header>
}

/** Delivery: where it stands, who received it and when; before that, nothing to fill in yet. */
export function DeliverPhase({ order, shipment }: { order: OrderDetail; shipment: Shipment | null }) {
  if (!shipment) return null
  const started = ["shipped", "delivered", "failed", "returned"].includes(shipment.status) || (order.deliveryMethod === "pickup" && shipment.status === "packed")
  if (!started) return <Empty icon={HandArrowDown} title="Aún no hay nada que registrar" hint={order.deliveryMethod === "pickup" ? "Cuando el pedido esté listo, el cliente lo recoge en la tienda." : "Primero tiene que salir con la transportadora o el mensajero."} />
  return <Panel icon={HandArrowDown} title={order.deliveryMethod === "pickup" ? "Recogida" : "Entrega"}>
    <dl className="glass-rows">
      <Row label="Estado"><DeliveryBadge status={shipment.status} method={shipment.method} /></Row>
      <Row label="Recibió">{shipment.recipientName}</Row>
      <Row label="Fecha">{shipment.deliveredAt ? dateTime(shipment.deliveredAt) : null}</Row>
      <Row label="Motivo">{shipment.failureReason}</Row>
      <Row label="Lleva">{shipment.courier ?? shipment.carrier}</Row>
      <Row label="Guía">{shipment.trackingCode}</Row>
    </dl>
  </Panel>
}

/** The order's phases as buttons: where it is (done, now, to do) and which one is on screen. */
export function PhaseSteps({ order, shown, onShow }: { order: OrderDetail; shown: Phase; onShow: (p: Phase) => void }) {
  const phases = phasesFor(order.deliveryMethod, order.paymentMethod === "cod" && !order.paidAt)
  return <ol className="glass-steps orders-phase-steps" aria-label="Fases del pedido">{phases.map((p, i) => {
    const state = phaseState(p.id, order.stage, order.deliveryStatus, order.deliveryMethod)
    return <li key={p.id} data-state={state}>
      <button type="button" aria-pressed={shown === p.id} onClick={() => onShow(p.id)} aria-label={`${p.label}, ${STATE_TEXT[state]}`}>
        <span className="glass-step-dot" aria-hidden="true">{state === "done" ? <Check size={12} /> : state === "bad" ? "!" : i + 1}</span>{p.label}{(state === "current" || state === "bad") && <span className="orders-step-now">ahora</span>}
      </button>
    </li>
  })}</ol>
}

const ATTEMPT_TONE = (status: string) => status === "approved" ? "good" : status === "declined" || status === "error" || status === "voided" ? "bad" : "neutral"

/**
 * Payment: a card with the amount, how and when it was paid (or that it is still to collect), the tries at the
 * gateway as a short list (the latest first, older ones folded) and, while unpaid, recording a payment by hand.
 */
export function PayPhase({ order, canManage, onRegister }: { order: OrderDetail; canManage: boolean; onRegister: (reference: string) => Promise<void> }) {
  const [reference, setReference] = useState(""), [paying, setPaying] = useState(false)
  const attempts = order.attempts ?? []
  const [last, ...older] = attempts
  const method = order.paymentMethod ? PAYMENT[order.paymentMethod] ?? order.paymentMethodTitle : "Sin método"
  const cod = order.paymentMethod === "cod" && !order.paidAt
  const status = order.paidAt ? { label: "Pagado", tone: "good" as const } : cod ? { label: "Se cobra al entregar", tone: "info" as const } : order.status === "on_hold" ? { label: "En espera", tone: "warn" as const } : { label: "Sin pagar", tone: "warn" as const }
  async function register(e: FormEvent) {
    e.preventDefault(); if (!reference.trim()) return
    setPaying(true)
    try { await onRegister(reference.trim()); setReference("") } finally { setPaying(false) }
  }
  const attempt = (a: NonNullable<OrderDetail["attempts"]>[number]) => <li key={a.reference} data-tone={ATTEMPT_TONE(a.status)}>
    <span className="orders-try-dot" aria-hidden="true" />
    <div className="min-w-0 flex-1">
      <p className="flex flex-wrap items-center gap-2"><strong>{ATTEMPT[a.status] ?? a.status}</strong><span className="text-stone-400">{PAYMENT[a.gateway] ?? a.gateway}</span>{a.sandbox && <Badge tone="warn">Pruebas</Badge>}</p>
      {a.detail && a.status !== "approved" && <p className="text-sm">{a.detail}</p>}
      <p className="text-xs text-stone-500">Referencia {a.reference}{a.externalId ? ` · transacción ${a.externalId}` : ""}</p>
    </div>
    <time className="shrink-0 text-xs text-stone-400" dateTime={a.updatedAt}>{dateTime(a.updatedAt)}</time>
  </li>
  return <div className="grid gap-4">
    <div className="orders-pay-card" data-tone={status.tone}>
      <div className="min-w-0">
        <p className="text-sm text-stone-400">{order.paidAt ? "Recibido" : cod ? "Por cobrar al entregar" : "Por cobrar"}</p>
        <p className="orders-pay-amount">{money(order.total)}</p>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-sm"><CreditCard size={16} aria-hidden="true" />{method}{order.paidAt && <span className="text-stone-400">· {dateTime(order.paidAt)}</span>}</p>
      </div>
      <Badge tone={status.tone}>{status.label}</Badge>
      {order.payments.filter(pm => pm.externalId).map(pm => <p key={pm.id} className="orders-pay-tx"><span className="text-stone-400">Transacción</span><span className="truncate">{pm.externalId}</span><CopyButton value={pm.externalId!} label="identificador de la transacción" /></p>)}
    </div>
    {last && <Panel icon={CreditCard} title="Intentos en la pasarela" action={<span className="orders-progress">{attempts.length}</span>}>
      <ul className="orders-tries">{attempt(last)}</ul>
      {older.length > 0 && <details className="orders-older mt-2"><summary>Ver {older.length === 1 ? "el intento anterior" : `${older.length} intentos anteriores`}</summary><ul className="orders-tries mt-2">{older.map(attempt)}</ul></details>}
    </Panel>}
    {canManage && (order.status === "pending" || order.status === "on_hold" || (order.status === "cancelled" && order.unpaidExpiredAt && !order.paidAt)) && <Panel icon={CreditCard} title="Registrar un pago a mano">
      <form onSubmit={register} className="grid gap-4"><p className="text-sm text-stone-400">{order.status === "cancelled" ? "El pago llegó después del plazo: al registrarlo, el pedido se reactiva si sus unidades siguen disponibles y el cliente recibe el correo de confirmación." : "Para transferencias o pagos en la tienda. El pedido pasa a pagado y el cliente recibe el correo de confirmación."}</p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="glass-label min-w-0 flex-1">Referencia del pago<input className="glass-field" value={reference} maxLength={120} onChange={e => setReference(e.target.value)} placeholder="Número de la transferencia o del recibo" /></label>
          <button className="glass-cta" disabled={paying || !reference.trim()}>{paying ? "Registrando…" : "Registrar pago"}</button>
        </div></form>
    </Panel>}
  </div>
}

/** What was already ticked while packing this order, kept in this browser only (a convenience, not order data). */
function usePacked(orderId: string) {
  const key = `arisma:alistado:${orderId}`
  const [packed, setPacked] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(key) ?? "[]") as string[]) } catch { return new Set() }
  })
  const toggle = (lineId: string) => setPacked(current => {
    const next = new Set(current)
    if (next.has(lineId)) next.delete(lineId); else next.add(lineId)
    try { localStorage.setItem(key, JSON.stringify(Array.from(next))) } catch { /* private mode: the ticks just are not remembered */ }
    return next
  })
  return { packed, toggle }
}

/** Preparation: a checklist of what to get ready (photo, reference, quantity), the customer's note and where it goes. */
export function PreparePhase({ order, onProduct }: { order: OrderDetail; onProduct: (id: string) => void }) {
  const { packed, toggle } = usePacked(order.id)
  const units = order.lines.reduce((a, l) => a + l.quantity, 0)
  const ready = order.lines.filter(l => packed.has(l.id)).length
  const preparing = order.stage === "to_prepare"
  const all = order.lines.length > 0 && ready === order.lines.length
  const address = order.shipping.address_1 ? order.shipping : order.billing
  const where = [address.address_1, address.city].filter(Boolean).join(", ")
  return <div className="grid gap-4">
    {order.customerNote && <div className="orders-note" role="note"><ChatCircleText size={20} aria-hidden="true" /><div><p className="font-semibold">El cliente escribió</p><p>{order.customerNote}</p></div></div>}
    <Panel icon={Package} title={`Para alistar · ${count(units)} ${units === 1 ? "unidad" : "unidades"}`} action={preparing && order.lines.length > 0 ? <span className="orders-progress" aria-live="polite">{ready} de {order.lines.length} {order.lines.length === 1 ? "listo" : "listos"}</span> : undefined}>
      {order.lines.length === 0 ? <Empty icon={Package} title="Este pedido no tiene productos" /> : <ul className="orders-pick">{order.lines.map(l => {
        const done = packed.has(l.id)
        return <li key={l.id} data-done={done || undefined}>
          {preparing && <input type="checkbox" className="orders-pick-check" checked={done} onChange={() => toggle(l.id)} aria-label={`Ya alisté ${l.title}`} />}
          <Thumb image={{ productId: l.productId, imageId: l.imageId, imageUrl: l.imageUrl, imageUploaded: l.imageUploaded }} size={64} />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{l.productId ? <button type="button" className="glass-row-link" onClick={() => onProduct(l.productId!)}>{l.title}<ArrowSquareOut size={12} aria-hidden="true" className="ml-1 inline" /></button> : l.title}</p>
            <p className="orders-sku">{l.sku ? `Ref. ${l.sku}` : "Sin referencia"}</p>
            {l.currentTitle && l.currentTitle !== l.title && <p className="text-xs text-stone-500">Hoy se llama “{l.currentTitle}”</p>}{l.productId == null && <p className="text-xs text-stone-500">El producto ya no existe en el catálogo</p>}
          </div>
          <span className="orders-qty" aria-label={`${l.quantity} ${l.quantity === 1 ? "unidad" : "unidades"}`}>{count(l.quantity)}</span>
        </li>
      })}</ul>}
      {preparing && all && <p className="orders-ready" role="status"><Check size={16} aria-hidden="true" />Todo está listo. Márcalo como empacado con el botón de abajo.</p>}
    </Panel>
    <div className="orders-goes"><MethodLabel method={order.deliveryMethod} />{order.deliveryMethod !== "pickup" && where && <span className="text-stone-400">· {where}</span>}</div>
  </div>
}

/**
 * Invoice: a document card (the PDF, its number, open it) and how it reached the customer; before that, one clear
 * way to attach and send it.
 */
export function InvoicePhase({ order, canManage, fileUrl, onOpen }: { order: OrderDetail; canManage: boolean; fileUrl: string; onOpen: () => void }) {
  const invoiceable = ["processing", "completed", "on_hold"].includes(order.status)
  const inv = order.invoice
  if (!invoiceable && !inv) return <Empty icon={FileText} title="Todavía no hay factura" hint="La factura se envía cuando el pedido está pagado." />
  if (inv?.status === "not_needed") return <Empty icon={FileText} title="Este pedido no requiere factura" hint="Se finalizó sin enviar una." />
  if (!inv) return <div className="orders-invoice-empty">
    <FilePdf size={40} aria-hidden="true" />
    <div><p className="font-semibold">Aún no hay factura</p><p className="text-sm text-stone-400">Sube el PDF que sacas de tu programa de facturación y envíaselo al cliente por correo o WhatsApp.</p></div>
    {canManage && <button type="button" className="glass-cta" onClick={onOpen}>Adjuntar y enviar</button>}
  </div>
  const channels = inv.channels.split(",").filter(Boolean)
  return <div className="grid gap-4">
    <div className="orders-invoice-doc">
      <FilePdf size={40} aria-hidden="true" className="shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{inv.fileName ?? "Factura"}</p>
        <p className="text-sm text-stone-400">{inv.number ? `Factura ${inv.number}` : "Sin número"} · {inv.status === "sent" ? <span className="text-emerald-300">enviada</span> : <span className="text-amber-200">sin enviar</span>}</p>
      </div>
      <a className="glass-chip" href={fileUrl} target="_blank" rel="noreferrer">Ver PDF</a>
      {canManage && <button type="button" className={inv.status === "sent" ? "glass-chip" : "glass-cta"} onClick={onOpen}>{inv.status === "sent" ? "Reenviar" : "Enviar"}</button>}
    </div>
    {inv.status === "sent" && <Panel icon={PaperPlaneTilt} title="Cómo le llegó">
      <ul className="orders-sent">{channels.map(c => <li key={c}>
        {c === "email" ? <EnvelopeSimple size={18} aria-hidden="true" /> : <WhatsappLogo size={18} aria-hidden="true" />}
        <span>{c === "email" ? <>Por correo{inv.sentTo ? <> a <strong>{inv.sentTo}</strong></> : null}</> : "Por WhatsApp, con el enlace de descarga"}</span>
      </li>)}</ul>
      {inv.sentAt && <p className="mt-2 text-xs text-stone-500">Último envío: {dateTime(inv.sentAt)}</p>}
    </Panel>}
  </div>
}

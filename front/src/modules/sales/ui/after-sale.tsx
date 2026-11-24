"use client"

import { useState, type FormEvent } from "react"
import { ArrowUUpLeft } from "@phosphor-icons/react"
import { REFUND_METHOD, refundStanding, type OrderDetail, type RefundAccountView, type RefundMethod, type RefundRecord } from "../domain/orders"
import { dateTime, money } from "../../shared/ui/format"
import { Badge } from "../../shared/ui/parts"
import { Panel } from "../../shared/ui/rich"
import { useSession } from "../../shared/ui/admin-context"
import { useOrdersPort } from "./use-orders"

const message = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback)

const ROUTE: Record<string, string> = { manual: "Registrado por la tienda", wompi: "Por Wompi", payu: "Por PayU", transfer: "Por transferencia" }
const STATUS: Record<string, { label: string; tone: "good" | "info" | "warn" | "bad" }> = {
  processing: { label: "En la pasarela", tone: "info" }, checking: { label: "Por revisar", tone: "bad" }, to_transfer: { label: "Por transferir", tone: "warn" }, succeeded: { label: "Devuelto", tone: "good" },
}

/**
 * After the sale: the money going back to the shopper. A cancellation of a paid order starts a refund through the
 * gateway that charged it, or by transfer to the account the shopper gave. Here the store sees where each one stands,
 * transfers the ones that need it (opening the account is recorded) and says what happened when a gateway did not
 * answer. A refund the store made on its own (a returned package) is recorded at the end.
 */
export function AfterSalePanel({ order, canManage, onChanged }: { order: OrderDetail; canManage: boolean; onChanged: (o: OrderDetail) => void }) {
  const { left, refunded, paid, open } = refundStanding(order)
  const requests = order.cancellations ?? [], refunds = order.refunds ?? []
  const request = requests.find(r => r.status === "requested")
  // a paid order cancelled before refunds moved money (or from the previous store, settled there)
  const owed = order.status === "cancelled" && left > 0 && !open && !order.migrated
  const invoiced = order.invoice?.status === "sent" && (order.status === "cancelled" || order.status === "refunded")
  if (!request && requests.length === 0 && refunds.length === 0 && paid === 0) return null
  return <Panel icon={ArrowUUpLeft} title="Cancelación y reembolsos">
    <div className="grid gap-4">
      {request && <CancelRequest order={order} reason={request.reason} at={request.requestedAt} canManage={canManage} onChanged={onChanged} />}
      {open && <OpenRefund order={order} refund={open} canManage={canManage} onChanged={onChanged} />}
      {owed && <p className="glass-banner" role="status">Falta devolverle {money(left)} al cliente. Devuélvelo en Wompi o PayU, por transferencia o en efectivo, y regístralo aquí.</p>}
      {invoiced && <p className="glass-banner" role="status">Este pedido tenía factura enviada: haz la nota crédito en tu programa de facturación.</p>}
      {requests.filter(r => r.status !== "requested").map(r => <p key={r.id} className="text-sm">
        <Badge tone={r.status === "approved" ? "good" : "neutral"}>{r.status === "approved" ? "Cancelación aprobada" : "Cancelación rechazada"}</Badge>{" "}
        «{r.reason}»{r.answer && <span className="block text-stone-500">Respuesta: {r.answer}</span>}
        <span className="block text-xs text-stone-500">{r.decidedAt ? dateTime(r.decidedAt) : ""}{r.decidedBy ? ` · ${r.decidedBy}` : ""}</span></p>)}
      {refunds.filter(r => (r.status ?? "succeeded") === "succeeded").length > 0 && <ul className="grid gap-2">{refunds.filter(r => (r.status ?? "succeeded") === "succeeded").map(r => <li key={r.id} className="text-sm">
        <Badge tone="good">Devuelto</Badge> <strong className="tabular-nums">{money(r.amount)}</strong> · {r.route && r.route !== "manual" ? ROUTE[r.route] : REFUND_METHOD[r.method]}{r.reference && ` · ref. ${r.reference}`}
        <span className="block text-xs text-stone-500">{dateTime(r.completedAt ?? r.refundedAt)}{r.createdBy ? ` · ${r.createdBy}` : ""}{r.note ? ` · ${r.note}` : ""}</span></li>)}</ul>}
      {paid > 0 && <p className="text-xs text-stone-500">Pagado {money(paid)} · devuelto {money(refunded)}{open ? ` · en curso ${money(open.amount)}` : ""} · por devolver {money(left)}</p>}
      {canManage && left > 0 && !open && <RefundForm order={order} left={left} prominent={owed} onChanged={onChanged} />}
    </div>
  </Panel>
}

/** The refund in progress: where it stands and what the store has to do, if anything. */
function OpenRefund({ order, refund, canManage, onChanged }: { order: OrderDetail; refund: RefundRecord; canManage: boolean; onChanged: (o: OrderDetail) => void }) {
  const api = useOrdersPort()
  const { csrf, notify, changed } = useSession()
  const [account, setAccount] = useState<RefundAccountView | null>(null), [reference, setReference] = useState("")
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [confirm, setConfirm] = useState<"done" | "not" | null>(null)
  const status = STATUS[refund.status] ?? STATUS.processing
  async function run(work: () => Promise<OrderDetail>, done: string) {
    setBusy(true); setError("")
    try { const next = await work(); notify(done); setReference(""); setConfirm(null); setAccount(null); changed(); onChanged(next) }
    catch (err) { setError(message(err, "No se pudo guardar")) } finally { setBusy(false) }
  }
  async function open() {
    setBusy(true); setError("")
    try { setAccount(await api.refundAccount(order.id, csrf)) } catch (err) { setError(message(err, "No se pudo abrir la cuenta")) } finally { setBusy(false) }
  }
  function transferred(e: FormEvent) {
    e.preventDefault()
    if (!reference.trim()) { setError("Escribe la referencia de la transferencia."); return }
    void run(() => api.markTransferred(order.id, reference.trim(), csrf), `Reembolso del pedido #${order.number} registrado como transferido.`)
  }
  return <div className="glass-banner grid gap-2" role="status">
    <p className="flex flex-wrap items-center gap-2"><Badge tone={status.tone}>{status.label}</Badge><strong className="tabular-nums">{money(refund.amount)}</strong> · {ROUTE[refund.route] ?? ""}
      <span className="text-xs text-stone-500">{refund.requestedBy === "shopper" ? "El cliente canceló" : "Cancelado por la tienda"} el {dateTime(refund.refundedAt)}</span></p>
    {refund.failure && <p className="text-sm">{refund.failure}</p>}
    {refund.status === "processing" && <p className="text-sm">{refund.route === "payu" ? "PayU lo está revisando (suele tardar de 1 a 3 días hábiles). La tienda le pregunta sola cada pocos minutos." : "Enviándolo a la pasarela."}{refund.gatewayReference && ` Referencia: ${refund.gatewayReference}.`}</p>}
    {refund.status === "checking" && canManage && <div className="grid gap-2">
      <p className="text-sm">Entra al panel de {refund.route === "payu" ? "PayU" : "Wompi"} y busca el pago de este pedido. ¿El reembolso aparece hecho?</p>
      {confirm === null ? <div className="flex flex-wrap gap-2">
        <button type="button" className="glass-chip" disabled={busy} onClick={() => setConfirm("done")}>Sí, aparece hecho</button>
        <button type="button" className="glass-chip" disabled={busy} onClick={() => setConfirm("not")}>No se hizo</button>
      </div> : <div className="grid gap-2">
        {confirm === "done" && <label className="glass-label">Referencia del reembolso en la pasarela (opcional)<input className="glass-field" maxLength={120} value={reference} onChange={e => setReference(e.target.value)} /></label>}
        <p className="text-sm">{confirm === "done" ? "El reembolso queda hecho y se le avisa al cliente." : "Pasa a transferencia: se le transfiere a la cuenta del cliente."}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="glass-cta" disabled={busy} onClick={() => void run(() => api.confirmChecked(order.id, confirm === "done", reference.trim(), csrf), confirm === "done" ? "Reembolso confirmado." : "El reembolso pasa a transferencia.")}>{busy ? "Guardando…" : "Confirmar"}</button>
          <button type="button" className="glass-chip" disabled={busy} onClick={() => setConfirm(null)}>Volver</button>
        </div>
      </div>}
    </div>}
    {refund.status === "to_transfer" && (!order.refundAccount
      ? <p className="text-sm">Esperando que el cliente escriba su cuenta en su pedido. Si quieres, escríbele por WhatsApp desde «Cliente».</p>
      : canManage && <div className="grid gap-2">
        {!account ? <button type="button" className="glass-chip justify-self-start" disabled={busy} onClick={() => void open()}>Ver la cuenta del cliente</button>
          : <dl className="glass-rows">
            <div><dt>Banco</dt><dd>{account.bank}</dd></div>
            {account.accountType !== "billetera" && <div><dt>Tipo</dt><dd>{account.accountType === "ahorros" ? "Ahorros" : "Corriente"}</dd></div>}
            <div><dt>{account.accountType === "billetera" ? "Celular" : "Número"}</dt><dd className="tabular-nums">{account.number}</dd></div>
            <div><dt>Titular</dt><dd>{account.holder}</dd></div>
            <div><dt>Documento</dt><dd>{account.documentType} {account.document}</dd></div>
          </dl>}
        <p className="text-xs text-stone-500">Abrir la cuenta queda en el historial del pedido. Se borra cuando registras la transferencia.</p>
        <form className="flex flex-wrap items-end gap-2" onSubmit={transferred} noValidate>
          <label className="glass-label min-w-0 flex-1">Referencia de la transferencia<input className="glass-field" maxLength={120} value={reference} onChange={e => setReference(e.target.value)} /></label>
          <button className="glass-cta" disabled={busy}>{busy ? "Guardando…" : "Ya la transferí"}</button>
        </form>
      </div>)}
    {error && <p className="glass-field-error" role="alert">{error}</p>}
  </div>
}

function CancelRequest({ order, reason, at, canManage, onChanged }: { order: OrderDetail; reason: string; at: string; canManage: boolean; onChanged: (o: OrderDetail) => void }) {
  const api = useOrdersPort()
  const { csrf, notify, changed } = useSession()
  const [mode, setMode] = useState<"idle" | "approve" | "reject">("idle"), [answer, setAnswer] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("")
  async function decide(e: FormEvent) {
    e.preventDefault(); setError("")
    if (mode === "reject" && answer.trim().length < 3) { setError("Explícale al cliente por qué no se puede cancelar."); return }
    setBusy(true)
    try {
      const next = mode === "approve" ? await api.approveCancellation(order.id, answer, csrf) : await api.rejectCancellation(order.id, answer, csrf)
      notify(mode === "approve" ? `Pedido #${order.number} cancelado a pedido del cliente.` : `Le respondiste al cliente del pedido #${order.number}.`)
      setMode("idle"); setAnswer(""); changed(); onChanged(next)
    } catch (err) { setError(message(err, "No se pudo guardar la respuesta")) } finally { setBusy(false) }
  }
  return <div className="glass-banner grid gap-2" role="status">
    <p><strong>El cliente pidió cancelar</strong> el {dateTime(at)}: «{reason}»</p>
    {refundStanding(order).paid > 0 && <p className="text-sm">Ya pagó {money(order.total)}: si apruebas, el pedido se cancela y luego registras aquí el reembolso.</p>}
    {canManage && mode === "idle" && <div className="flex flex-wrap gap-2">
      <button type="button" className="glass-cta" onClick={() => setMode("approve")}>Aprobar cancelación</button>
      <button type="button" className="glass-chip" onClick={() => setMode("reject")}>Rechazar</button>
    </div>}
    {mode !== "idle" && <form className="grid gap-2" onSubmit={decide} noValidate>
      <label className="glass-label">{mode === "approve" ? "Mensaje para el cliente (opcional)" : "Por qué no se puede cancelar (lo ve el cliente)"}
        <textarea className="glass-field" rows={2} maxLength={500} value={answer} onChange={e => setAnswer(e.target.value)} />
      </label>
      {error && <p className="glass-field-error" role="alert">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button className={mode === "approve" ? "glass-cta" : "glass-chip glass-chip-danger"} disabled={busy}>{busy ? "Guardando…" : mode === "approve" ? "Sí, cancelar el pedido" : "Rechazar la solicitud"}</button>
        <button type="button" className="glass-chip" disabled={busy} onClick={() => { setMode("idle"); setError("") }}>Volver</button>
      </div>
    </form>}
  </div>
}

function RefundForm({ order, left, prominent, onChanged }: { order: OrderDetail; left: number; prominent: boolean; onChanged: (o: OrderDetail) => void }) {
  const api = useOrdersPort()
  const { csrf, notify, changed } = useSession()
  const [open, setOpen] = useState(prominent)
  const [amount, setAmount] = useState(String(Math.round(left))), [method, setMethod] = useState<RefundMethod>(order.paymentMethod === "wompi" || order.paymentMethod === "payu" ? "gateway" : "transfer")
  const [reference, setReference] = useState(""), [note, setNote] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("")
  async function save(e: FormEvent) {
    e.preventDefault(); setError("")
    const value = Number(amount.replace(/[^0-9]/g, ""))
    if (!value) { setError("Escribe cuánto devolviste."); return }
    if (value > left) { setError(`Solo queda por devolver ${money(left)}.`); return }
    setBusy(true)
    try {
      const next = await api.recordRefund(order.id, { amount: value, method, reference: reference.trim(), note: note.trim() }, csrf)
      notify(`Reembolso de ${money(value)} registrado en el pedido #${order.number}.`)
      setReference(""); setNote(""); changed(); onChanged(next)
    } catch (err) { setError(message(err, "No se pudo registrar el reembolso")) } finally { setBusy(false) }
  }
  if (!open) return <button type="button" className="glass-chip justify-self-start" onClick={() => setOpen(true)}>Registrar un reembolso</button>
  return <form className="grid gap-2" onSubmit={save} noValidate>
    <div className="grid gap-2">
      <label className="glass-label">Valor devuelto
        <input className="glass-field tabular-nums" inputMode="numeric" value={amount} onChange={e => setAmount(e.target.value)} />
      </label>
      <label className="glass-label">Cómo se devolvió
        <select className="glass-field" value={method} onChange={e => setMethod(e.target.value as RefundMethod)}>
          {(Object.keys(REFUND_METHOD) as RefundMethod[]).map(m => <option key={m} value={m}>{REFUND_METHOD[m]}</option>)}
        </select>
      </label>
    </div>
    <label className="glass-label">Referencia (opcional)
      <input className="glass-field" maxLength={120} value={reference} onChange={e => setReference(e.target.value)} placeholder="El número del reembolso en Wompi o PayU, o de la transferencia" />
    </label>
    <label className="glass-label">Nota interna (opcional)
      <input className="glass-field" maxLength={500} value={note} onChange={e => setNote(e.target.value)} />
    </label>
    {error && <p className="glass-field-error" role="alert">{error}</p>}
    <div className="flex flex-wrap gap-2">
      <button className="glass-cta" disabled={busy}>{busy ? "Guardando…" : "Registrar reembolso"}</button>
      {!prominent && <button type="button" className="glass-chip" disabled={busy} onClick={() => setOpen(false)}>Cerrar</button>}
    </div>
    <p className="text-xs text-stone-500">Esto no mueve dinero: registra el reembolso que ya hiciste. Cuando se devuelve todo lo pagado, el pedido queda «Reembolsado» y el cliente lo ve en su pedido.</p>
  </form>
}

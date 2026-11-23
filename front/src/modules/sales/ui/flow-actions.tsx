"use client"

import { useEffect, useRef, useState } from "react"
import { DotsThree, Truck, WarningCircle } from "@phosphor-icons/react"
import { flow, type FlowContext, type Step } from "../domain/stage"
import { Dialog } from "../../shared/ui/parts"
import { useCan, useSession } from "../../shared/ui/admin-context"
import { MoveForm } from "../../fulfillment/ui/move-form"
import { useFulfillmentPort } from "../../fulfillment/ui/use-fulfillment"
import { useOrdersPort } from "./use-orders"
import { InvoiceDialog } from "./invoice-dialog"

/** What happened, said as a result (the button says what to do). */
const DONE: Record<string, string> = { packed: "quedó empacado", shipped: "va en camino", delivered: "quedó entregado", failed: "quedó como no entregado", returned: "quedó como devuelto", pending: "volvió a por preparar",
  processing: "pago confirmado, listo para preparar", on_hold: "quedó en espera", cancelled: "quedó cancelado", refunded: "quedó reembolsado",
  not_needed: "quedó finalizado sin factura" }
export type FlowTarget = FlowContext & { orderId: string; number: string; carrier?: string | null; trackingCode?: string | null }

/** Runs one step: straight away, after a confirmation, or after asking the delivery data it needs. */
function useRunStep(target: FlowTarget, onDone?: () => void) {
  const orders = useOrdersPort(), fulfillment = useFulfillmentPort()
  const { csrf, notify, changed } = useSession()
  const [pending, setPending] = useState<Step | null>(null)
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [note, setNote] = useState("")
  const [invoicing, setInvoicing] = useState(false)
  const finish = (step: Step) => { notify(`Pedido #${target.number} ${DONE[step.action.status] ?? step.label.toLowerCase()}.`); setPending(null); setNote(""); changed(); onDone?.() }
  async function execute(step: Step) {
    setBusy(true); setError("")
    try {
      if (step.action.kind === "order") await orders.changeStatus(target.orderId, step.action.status, note, csrf)
      else if (step.action.kind === "invoice") await orders.invoiceNotNeeded(target.orderId, csrf)
      else await fulfillment.move(target.orderId, step.action.status, { note }, csrf)
      finish(step)
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo completar"); setPending(step) } finally { setBusy(false) }
  }
  const start = (step: Step) => {
    setError("")
    if (step.action.kind === "invoice" && step.action.status === "send") setInvoicing(true)
    else if (step.form || step.confirm) setPending(step)
    else void execute(step)
  }
  const dialog = pending && <Dialog eyebrow={`Pedido #${target.number}`} title={pending.label} busy={busy} media={<span className="glass-panel-icon">{pending.tone === "danger" ? <WarningCircle size={20} aria-hidden="true" /> : <Truck size={20} aria-hidden="true" />}</span>} onClose={() => setPending(null)}>
    {pending.form && pending.action.kind === "delivery"
      ? <MoveForm orderId={target.orderId} method={target.deliveryMethod} target={pending.action.status} current={{ carrier: target.carrier ?? null, trackingCode: target.trackingCode ?? null }} onDone={() => finish(pending)} onCancel={() => setPending(null)} />
      : <div className="grid gap-4">
        {error && <p role="alert" className="glass-alert">{error}</p>}
        <p className="text-sm">{pending.confirm}</p>
        {pending.action.kind !== "invoice" && <label className="glass-label">Motivo (opcional)<input className="glass-field" value={note} onChange={e => setNote(e.target.value)} placeholder="Queda en el historial del pedido" autoFocus /></label>}
        <div className="flex flex-wrap justify-end gap-2"><button type="button" className="glass-chip" disabled={busy} onClick={() => setPending(null)}>Volver</button><button type="button" className={pending.tone === "danger" ? "glass-chip glass-chip-danger" : "glass-cta"} disabled={busy} onClick={() => void execute(pending)}>{busy ? "Guardando…" : pending.label}</button></div>
      </div>}
  </Dialog>
  const invoiceDialog = invoicing && <InvoiceDialog orderId={target.orderId} onClose={() => setInvoicing(false)} onSent={() => { setInvoicing(false); changed(); onDone?.() }} />
  return { start, busy, error, dialog: dialog || invoiceDialog || null }
}

/** "More" menu for the less common steps. Closes on outside click or Escape. */
/** `text` shows a labelled button (order detail) instead of the dots; `up` opens the list above it (footer). */
function MoreMenu({ steps, onPick, disabled, label = "Más acciones", text, up }: { steps: Step[]; onPick: (s: Step) => void; disabled?: boolean; label?: string; text?: string; up?: boolean }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent | KeyboardEvent) => { if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener("mousedown", close); document.addEventListener("keydown", close)
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close) }
  }, [open])
  if (steps.length === 0) return null
  return <div className="glass-menu" ref={ref}>
    {text
      ? <button type="button" className="glass-chip" aria-haspopup="menu" aria-expanded={open} disabled={disabled} onClick={e => { e.stopPropagation(); setOpen(o => !o) }}>{text}<DotsThree size={16} weight="bold" aria-hidden="true" className="ml-1" /></button>
      : <button type="button" className="glass-icon-button" aria-label={label} title={label} aria-haspopup="menu" aria-expanded={open} disabled={disabled} onClick={e => { e.stopPropagation(); setOpen(o => !o) }}><DotsThree size={20} weight="bold" aria-hidden="true" /></button>}
    {open && <ul role="menu" className="glass-menu-list" data-up={up || undefined}>{steps.map(s => <li key={s.id} role="none"><button type="button" role="menuitem" data-tone={s.tone} onClick={e => { e.stopPropagation(); setOpen(false); onPick(s) }}>{s.label}</button></li>)}</ul>}
  </div>
}

/**
 * The order's next step as one primary button, the rest in a menu.
 * variant="footer" (order detail) labels the menu "Otras acciones" and opens it upwards; "compact" (list, board) uses the dots.
 */
export function FlowActions({ target, variant = "compact", onDone }: { target: FlowTarget; variant?: "compact" | "footer"; onDone?: () => void }) {
  const can = useCan()
  const run = useRunStep(target, onDone)
  const { primary, secondary } = flow(target)
  const allowed = (s: Step) => s.action.kind === "delivery" ? can("FULFILLMENT_MANAGE") : can("ORDERS_MANAGE")
  const main = primary && allowed(primary) ? primary : null
  const rest = secondary.filter(allowed)
  if (!main && rest.length === 0) return variant === "footer" ? <span className="text-sm text-stone-500">Este pedido no tiene pasos pendientes.</span> : null
  return <div className="glass-flow" onClick={e => e.stopPropagation()}>
    {run.error && !run.dialog && <span role="alert" className="glass-field-error">{run.error}</span>}
    {variant === "footer" ? <>
      {/* one clear next step; the less common ones (cancel, hold, skip ahead) wait in a menu */}
      <MoreMenu steps={rest} onPick={run.start} disabled={run.busy} text="Otras acciones" up />
      {main && <button type="button" className="glass-cta" disabled={run.busy} onClick={() => run.start(main)}>{run.busy ? "Guardando…" : main.label}</button>}
    </> : <>
      {main && <button type="button" className="glass-chip glass-chip-primary glass-flow-primary" disabled={run.busy} onClick={() => run.start(main)}>{run.busy ? "…" : main.label}</button>}
      <MoreMenu steps={rest} onPick={run.start} disabled={run.busy} label={`Más acciones del pedido #${target.number}`} />
    </>}
    {run.dialog}
  </div>
}

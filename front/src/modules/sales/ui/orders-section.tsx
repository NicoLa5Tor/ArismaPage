"use client"

import { useState } from "react"
import { CalendarBlank, CaretDown, ClockCounterClockwise, Kanban, ListBullets, Receipt, Tray, X } from "@phosphor-icons/react"
import { BULK_STEPS, STAGES, WORK_STAGES } from "../domain/stage"
import { count, money, plural } from "../../shared/ui/format"
import { Async, Card, Dialog, Pager, Search, useDebounced, useLoad } from "../../shared/ui/parts"
import { Segmented } from "../../shared/ui/rich"
import { useCan, useSession } from "../../shared/ui/admin-context"
import { METHOD } from "../../fulfillment/ui/labels"
import { useFulfillmentPort } from "../../fulfillment/ui/use-fulfillment"
import type { DeliveryMethod } from "../../fulfillment/domain/fulfillment"
import { OrdersBoard } from "./orders-board"
import { OrdersList } from "./orders-list"
import { STAGE } from "./stage"
import { useOrdersPort } from "./use-orders"

const IN_PROGRESS = WORK_STAGES.join(",")
const STALE_DAYS = 60
const STAGE_EMPTY: Record<string, string> = { cancel_request: "que pidan cancelar", refund_pending: "con reembolsos pendientes", unpaid: "sin pagar", to_prepare: "por preparar", packed: "empacados", shipped: "en camino", to_invoice: "por facturar", issue: "que requieran atención", delivered: "finalizados", cancelled: "cancelados", [IN_PROGRESS]: "en curso" }
type View = "list" | "board"
type Scope = "work" | "history"

/**
 * Orders and their delivery as one journey. «En curso» is what the store still has to do; «Historial» keeps the
 * finished, cancelled and migrated ones out of the way. One compact bar holds the search and the filters, so the
 * screen is for the orders.
 */
export function OrdersSection({ initialStage = "", initialView = "list" }: { initialStage?: string; initialView?: string }) {
  const api = useOrdersPort(), fulfillment = useFulfillmentPort()
  const { csrf, notify, version, changed, go, openOrder } = useSession()
  const can = useCan()
  // cancelled orders live in the history: a link to them opens it
  const [scope, setScope] = useState<Scope>(initialStage === "cancelled" || initialStage === "refund_pending" ? "history" : "work")
  const [view, setView] = useState<View>(initialView === "tablero" ? "board" : "list")
  const [stage, setStage] = useState(initialStage)
  const [method, setMethod] = useState<DeliveryMethod | "">("")
  const [from, setFrom] = useState(""), [to, setTo] = useState(""), [q, setQ] = useState(""), [offset, setOffset] = useState(0)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false), [bulkError, setBulkError] = useState(""), [confirm, setConfirm] = useState<"cancel" | null>(null)
  const query = useDebounced(q)
  const history = scope === "history"
  const orders = useLoad(() => api.list({ status: "", from, to, q: query, offset, stage, history }), [from, to, query, offset, stage, history, version])
  const board = useLoad(() => fulfillment.board(method, query, STALE_DAYS), [method, query, version])
  const filter = (fn: () => void) => { fn(); setOffset(0); setSelected(new Set()) }
  // The view lives in the URL (?vista=tablero) so a reload or a shared link opens the same view.
  const switchView = (v: View) => { setView(v); go("orders", { ...(stage ? { etapa: stage } : {}), ...(v === "board" ? { vista: "tablero" } : {}) }) }
  const switchScope = (s: Scope) => filter(() => { setScope(s); setStage(""); if (s === "history") setView("list") })
  const rows = orders.data?.items ?? []
  const counts = orders.data?.stageCounts ?? {}
  const total = Object.values(counts).reduce((a, b) => a + (b ?? 0), 0)
  const inProgress = WORK_STAGES.reduce((a, s) => a + (counts[s] ?? 0), 0)
  // only the stages that have orders here (and the one chosen), with how many
  const stageOptions = STAGES.filter(s => (counts[s] ?? 0) > 0 || stage === s)

  // Bulk: one common step when every selected order is in the same stage, plus cancel.
  const selectedRows = rows.filter(r => selected.has(r.id))
  const sameStage = selectedRows.length > 0 && selectedRows.every(r => r.stage === selectedRows[0].stage) ? selectedRows[0].stage : null
  const bulkStep = sameStage ? BULK_STEPS[sameStage] : undefined
  const canCancel = selectedRows.length > 0 && selectedRows.every(r => r.stage !== "cancelled" && r.stage !== "delivered" && r.stage !== "to_invoice") && can("ORDERS_MANAGE")
  async function runBulk(kind: "step" | "cancel") {
    setBusy(true); setBulkError(""); setConfirm(null)
    try {
      const ids = Array.from(selected)
      if (kind === "cancel") { const r = await api.changeStatuses(ids, "cancelled", "Cancelado en lote", csrf); notify(`${plural(r.updated, "pedido cancelado", "pedidos cancelados")}.${r.failed.length ? ` ${r.failed.length} no se pudieron cancelar.` : ""}`) }
      else if (bulkStep?.action.kind === "delivery") { const r = await fulfillment.moveAll(ids, bulkStep.action.status, "Cambio en lote", csrf); notify(`${plural(r.updated, "pedido actualizado", "pedidos actualizados")}.${r.failed.length ? ` ${r.failed.length} no se pudieron: ${r.failed[0].error}` : ""}`) }
      setSelected(new Set()); changed()
    } catch (e) { setBulkError(e instanceof Error ? e.message : "No se pudo completar") } finally { setBusy(false) }
  }
  const allOnPage = rows.length > 0 && rows.every(r => selected.has(r.id))
  const hasFilters = [stage, from, to, q.trim(), method].some(Boolean)
  const dated = Boolean(from || to)

  const subtitle = orders.data
    ? history ? `${plural(orders.data.total, "pedido", "pedidos")} finalizados, cancelados o de la tienda anterior` : `${plural(orders.data.total, "pedido", "pedidos")} · ${money(orders.data.amount)}${inProgress ? ` · ${count(inProgress)} por atender` : ""}`
    : "Del pago a la entrega, en un solo lugar"

  return <div className="glass-scroll glass-orders">
    <Card className="glass-orders-card" icon={Receipt} title="Pedidos" subtitle={subtitle}
      actions={<Segmented label="Qué pedidos ver" value={scope} onChange={switchScope} options={[{ value: "work", label: "En curso", icon: Tray }, { value: "history", label: "Historial", icon: ClockCounterClockwise }]} />}>
      <div className="orders-bar">
        <div className="orders-bar-search"><Search value={q} onChange={v => filter(() => setQ(v))} label="Buscar por número, cliente, correo o teléfono" /></div>
        {view === "list" && <label className="orders-bar-select"><span className="sr-only">Etapa</span>
          <select className="glass-field" value={stage} onChange={e => filter(() => setStage(e.target.value))}>
            <option value="">{history ? "Todo el historial" : "Todas las etapas"} ({count(total)})</option>
            {!history && inProgress > 0 && inProgress !== total && <option value={IN_PROGRESS}>Por atender ({count(inProgress)})</option>}
            {stageOptions.map(s => <option key={s} value={s}>{STAGE[s].label} ({count(counts[s] ?? 0)})</option>)}
            {!history && <option value="cancel_request">Piden cancelar</option>}
            {history && <option value="refund_pending">Reembolsos pendientes</option>}
          </select>
        </label>}
        {view === "board" && <label className="orders-bar-select"><span className="sr-only">Entrega</span>
          <select className="glass-field" value={method} onChange={e => setMethod(e.target.value as DeliveryMethod | "")}>
            <option value="">Todos los métodos</option>{(Object.keys(METHOD) as DeliveryMethod[]).map(m => <option key={m} value={m}>{METHOD[m].label}</option>)}
          </select>
        </label>}
        {view === "list" && <details className="orders-bar-dates" name="orders-popovers">
          <summary data-active={dated || undefined}><CalendarBlank size={16} aria-hidden="true" /><span>{dated ? [from, to].filter(Boolean).join(" → ") : "Fechas"}</span><CaretDown size={14} aria-hidden="true" /></summary>
          <div className="orders-bar-popover glass-dates">
            <label className="glass-label">Desde<input type="date" className="glass-field" value={from} max={to || undefined} onChange={e => filter(() => setFrom(e.target.value))} /></label>
            <label className="glass-label">Hasta<input type="date" className="glass-field" value={to} min={from || undefined} onChange={e => filter(() => setTo(e.target.value))} /></label>
          </div>
        </details>}
        {!history && <Segmented label="Vista" value={view} onChange={switchView} options={[{ value: "list", label: "Lista", icon: ListBullets }, { value: "board", label: "Tablero", icon: Kanban }]} />}
        {hasFilters && <button type="button" className="glass-chip" onClick={() => filter(() => { setStage(""); setFrom(""); setTo(""); setQ(""); setMethod("") })}><X size={14} aria-hidden="true" />Limpiar</button>}
      </div>
      <div className="orders-results mt-4">{view === "board" && !history
        ? <Async state={board} label="Cargando tablero" rows={4}>{b => <OrdersBoard board={b} onShowAll={s => { setView("list"); filter(() => setStage(s)) }} />}</Async>
        : <Async state={orders} label="Cargando pedidos" rows={6} empty={{ icon: history ? ClockCounterClockwise : Receipt,
            title: q.trim() ? "No hay pedidos con esta búsqueda" : stage ? `No hay pedidos ${STAGE_EMPTY[stage] ?? "aquí"}` : history ? "El historial está vacío" : "No hay pedidos por atender",
            hint: history ? "Aquí quedan los pedidos finalizados, los cancelados y los de la tienda anterior." : "Los pedidos nuevos aparecen aquí. Los finalizados y los de la tienda anterior están en Historial.", when: d => d.items.length === 0 }}>{d => <>
          <OrdersList rows={d.items} history={history} onOpen={o => openOrder(o.id)}
            selection={!history && (can("ORDERS_MANAGE") || can("FULFILLMENT_MANAGE")) ? { selected, onToggle: id => setSelected(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n }), onToggleAll: () => setSelected(s => { const n = new Set(s); rows.forEach(r => allOnPage ? n.delete(r.id) : n.add(r.id)); return n }) } : undefined} />
          <Pager offset={offset} total={d.total} onChange={o => { setOffset(o); setSelected(new Set()) }} />
        </>}</Async>}</div>
    </Card>
    {selected.size > 0 && view === "list" && <div className="glass-bulk" role="region" aria-label="Acciones en lote">
      <span className="text-sm font-semibold">{plural(selected.size, "seleccionado", "seleccionados")}{sameStage && ` · ${STAGE[sameStage].label.toLowerCase()}`}</span>
      {bulkStep && can("FULFILLMENT_MANAGE") && <button type="button" className="glass-cta" disabled={busy} onClick={() => void runBulk("step")}>{busy ? "Aplicando…" : bulkStep.label}</button>}
      {!sameStage && <span className="text-sm text-stone-500">Selecciona pedidos de la misma etapa para avanzarlos juntos.</span>}
      {canCancel && <button type="button" className="glass-chip glass-chip-danger" disabled={busy} onClick={() => setConfirm("cancel")}>Cancelar</button>}
      <button type="button" className="glass-chip" disabled={busy} onClick={() => setSelected(new Set())}>Quitar selección</button>
      {bulkError && <p role="alert" className="glass-alert w-full">{bulkError}</p>}
    </div>}
    {confirm === "cancel" && <Dialog eyebrow="Pedidos" title={`Cancelar ${plural(selected.size, "pedido", "pedidos")}`} busy={busy} onClose={() => setConfirm(null)}>
      <div className="grid gap-4"><p className="text-sm">Se cancelan los pedidos y sus envíos; las unidades descontadas vuelven al inventario.</p>
        <div className="flex justify-end gap-2"><button type="button" className="glass-chip" onClick={() => setConfirm(null)}>Volver</button><button type="button" className="glass-chip glass-chip-danger" disabled={busy} onClick={() => void runBulk("cancel")}>Sí, cancelar</button></div></div>
    </Dialog>}
  </div>
}

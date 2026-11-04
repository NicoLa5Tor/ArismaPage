"use client"

import { useState } from "react"
import { Kanban, ListBullets, Receipt, WarningCircle, X } from "@phosphor-icons/react"
import type { OrderRow } from "../domain/orders"
import { BULK_STEPS, STAGES, WORK_STAGES } from "../domain/stage"
import { count, date, money, plural, time } from "../../shared/ui/format"
import { Async, Card, Chips, Dialog, Pager, Search, useDebounced, useLoad } from "../../shared/ui/parts"
import { Segmented } from "../../shared/ui/rich"
import { DataTable, type Column } from "../../shared/ui/data-table"
import { useCan, useSession } from "../../shared/ui/admin-context"
import { METHOD } from "../../fulfillment/ui/labels"
import { useFulfillmentPort } from "../../fulfillment/ui/use-fulfillment"
import type { DeliveryMethod } from "../../fulfillment/domain/fulfillment"
import { FlowActions } from "./flow-actions"
import { OrdersBoard } from "./orders-board"
import { PAYMENT } from "./labels"
import { STAGE, StageBadge } from "./stage"
import { useOrdersPort } from "./use-orders"

const IN_PROGRESS = WORK_STAGES.join(",")
const STALE_DAYS = 60
type View = "list" | "board"

const COLUMNS: Column<OrderRow>[] = [
  { key: "number", label: "Pedido", primary: true, render: o => <span>#{o.number}<span className="block text-xs font-normal muted">{date(o.placedAt)} · {time(o.placedAt)}</span></span> },
  { key: "customer", label: "Cliente", render: o => <span className="block min-w-0"><span className="block max-w-56 truncate">{o.customerName ?? "Sin nombre"}</span><span className="block max-w-56 truncate text-xs muted">{o.city ?? o.customerEmail ?? ""}</span></span> },
  { key: "stage", label: "Etapa", render: o => { const M = METHOD[o.deliveryMethod]; return <span className="grid justify-items-start gap-1"><StageBadge stage={o.stage} method={o.deliveryMethod} /><span className="flex items-center gap-1 text-xs muted"><M.icon size={12} aria-hidden="true" />{o.trackingCode ?? M.label}</span></span> } },
  { key: "payment", label: "Pago", desktopOnly: true, render: o => <span className="muted">{o.paymentMethod ? PAYMENT[o.paymentMethod] ?? o.paymentMethodTitle : "—"}</span> },
  { key: "total", label: "Total", numeric: true, render: o => <span className="font-semibold">{money(o.total)}</span> },
  { key: "next", label: "Siguiente paso", render: o => <FlowActions target={{ orderId: o.id, number: o.number, stage: o.stage, orderStatus: o.status, deliveryStatus: o.deliveryStatus, deliveryMethod: o.deliveryMethod, paymentMethod: o.paymentMethod, trackingCode: o.trackingCode }} /> },
]

/** Orders and their delivery as one journey: a list to find anything, a board to move today's work. */
export function OrdersSection({ initialStage = "", initialView = "list" }: { initialStage?: string; initialView?: string }) {
  const api = useOrdersPort(), fulfillment = useFulfillmentPort()
  const { csrf, notify, version, changed, go, openOrder } = useSession()
  const can = useCan()
  const [view, setView] = useState<View>(initialView === "tablero" ? "board" : "list")
  const [stage, setStage] = useState(initialStage)
  const [method, setMethod] = useState<DeliveryMethod | "">("")
  const [from, setFrom] = useState(""), [to, setTo] = useState(""), [q, setQ] = useState(""), [offset, setOffset] = useState(0)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false), [bulkError, setBulkError] = useState(""), [confirm, setConfirm] = useState<"cancel" | "stale" | null>(null)
  const query = useDebounced(q)
  const orders = useLoad(() => api.list({ status: "", from, to, q: query, offset, stage }), [from, to, query, offset, stage, version])
  const board = useLoad(() => fulfillment.board(method, query, STALE_DAYS), [method, query, version])
  const filter = (fn: () => void) => { fn(); setOffset(0); setSelected(new Set()) }
  // The view lives in the URL (?vista=tablero) so a reload or a shared link opens the same view.
  const switchView = (v: View) => { setView(v); go("orders", { ...(stage ? { etapa: stage } : {}), ...(v === "board" ? { vista: "tablero" } : {}) }) }
  const rows = orders.data?.items ?? []
  const counts = orders.data?.stageCounts ?? {}
  const total = Object.values(counts).reduce((a, b) => a + (b ?? 0), 0)
  const inProgress = WORK_STAGES.reduce((a, s) => a + (counts[s] ?? 0), 0)

  // Bulk: one common step when every selected order is in the same stage, plus cancel.
  const selectedRows = rows.filter(r => selected.has(r.id))
  const sameStage = selectedRows.length > 0 && selectedRows.every(r => r.stage === selectedRows[0].stage) ? selectedRows[0].stage : null
  const bulkStep = sameStage ? BULK_STEPS[sameStage] : undefined
  const canCancel = selectedRows.length > 0 && selectedRows.every(r => r.stage !== "cancelled" && r.stage !== "delivered") && can("ORDERS_MANAGE")
  async function runBulk(kind: "step" | "cancel" | "stale") {
    setBusy(true); setBulkError(""); setConfirm(null)
    try {
      const ids = Array.from(selected)
      if (kind === "stale") { const r = await fulfillment.closeStale(STALE_DAYS, csrf); notify(`${plural(r.updated, "pedido antiguo cerrado", "pedidos antiguos cerrados")} como entregado.`) }
      else if (kind === "cancel") { const r = await api.changeStatuses(ids, "cancelled", "Cancelado en lote", csrf); notify(`${plural(r.updated, "pedido cancelado", "pedidos cancelados")}.${r.failed.length ? ` ${r.failed.length} no se pudieron cancelar.` : ""}`) }
      else if (bulkStep?.action.kind === "delivery") { const r = await fulfillment.moveAll(ids, bulkStep.action.status, "Cambio en lote", csrf); notify(`${plural(r.updated, "pedido actualizado", "pedidos actualizados")}.${r.failed.length ? ` ${r.failed.length} no se pudieron: ${r.failed[0].error}` : ""}`) }
      setSelected(new Set()); changed()
    } catch (e) { setBulkError(e instanceof Error ? e.message : "No se pudo completar") } finally { setBusy(false) }
  }
  const allOnPage = rows.length > 0 && rows.every(r => selected.has(r.id))
  const hasFilters = !!(stage || from || to || q || method)
  const stale = board.data?.stale ?? 0

  return <div className="glass-scroll">
    <Card icon={Receipt} title="Pedidos" subtitle={orders.data ? `${plural(orders.data.total, "pedido", "pedidos")} · ${money(orders.data.amount)}${inProgress ? ` · ${count(inProgress)} en curso` : ""}` : "Pago, preparación y entrega en un solo lugar"}
      actions={<><Segmented label="Vista" value={view} onChange={switchView} options={[{ value: "list", label: "Lista", icon: ListBullets }, { value: "board", label: "Tablero", icon: Kanban }]} />
        {hasFilters && <button type="button" className="glass-chip" onClick={() => filter(() => { setStage(""); setFrom(""); setTo(""); setQ(""); setMethod("") })}><X size={14} aria-hidden="true" />Limpiar</button>}</>}>
      <div className="mt-4 grid gap-4">
        {can("FULFILLMENT_MANAGE") && stale > 0 && <div className="glass-banner" role="status"><span className="flex items-center gap-2"><WarningCircle size={18} aria-hidden="true" />{plural(stale, "pedido pagado", "pedidos pagados")} de hace más de {STALE_DAYS} días siguen “por preparar”: vienen de la tienda anterior y nunca se marcaron como entregados.</span>
          {confirm === "stale" ? <span className="flex flex-wrap items-center gap-2"><span className="text-sm">Quedarán entregados y completados.</span><button type="button" className="glass-chip glass-chip-primary" disabled={busy} onClick={() => void runBulk("stale")}>{busy ? "Cerrando…" : "Sí, cerrarlos"}</button><button type="button" className="glass-chip" onClick={() => setConfirm(null)}>No</button></span>
            : <button type="button" className="glass-chip" onClick={() => setConfirm("stale")}>Marcarlos como entregados</button>}</div>}
        <div className="glass-filters">
          <Search value={q} onChange={v => filter(() => setQ(v))} label="Buscar por número, cliente, correo o teléfono" />
          {view === "list" && <div className="glass-dates"><label className="glass-label">Desde<input type="date" className="glass-field" value={from} max={to || undefined} onChange={e => filter(() => setFrom(e.target.value))} /></label><label className="glass-label">Hasta<input type="date" className="glass-field" value={to} min={from || undefined} onChange={e => filter(() => setTo(e.target.value))} /></label></div>}
        </div>
        {view === "list"
          ? <Chips label="Etapa" value={stage} onChange={v => filter(() => setStage(v))} options={[{ value: "", label: "Todos", count: total }, { value: IN_PROGRESS, label: "En curso", count: inProgress }, ...STAGES.map(s => ({ value: s, label: STAGE[s].label, count: counts[s] ?? 0 }))]} />
          : <Chips label="Método de entrega" value={method} onChange={setMethod} options={[{ value: "", label: "Todos los métodos" }, ...(Object.keys(METHOD) as DeliveryMethod[]).map(m => ({ value: m, label: METHOD[m].label }))]} />}
      </div>
      <div className="mt-4">{view === "board"
        ? <Async state={board} label="Cargando tablero" rows={4}>{b => <OrdersBoard board={b} onShowAll={s => { setView("list"); filter(() => setStage(s)) }} />}</Async>
        : <Async state={orders} label="Cargando pedidos" rows={6} empty={{ icon: Receipt, title: "No hay pedidos con estos filtros", hint: "Cambia la etapa o el rango de fechas.", when: d => d.items.length === 0 }}>{d => <>
          <DataTable caption="Pedidos" rows={d.items} columns={COLUMNS} onOpen={o => openOrder(o.id)}
            selection={can("ORDERS_MANAGE") || can("FULFILLMENT_MANAGE") ? { selected, onToggle: id => setSelected(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n }), label: id => `Seleccionar pedido ${rows.find(r => r.id === id)?.number ?? ""}`, onToggleAll: () => setSelected(s => { const n = new Set(s); rows.forEach(r => allOnPage ? n.delete(r.id) : n.add(r.id)); return n }) } : undefined} />
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

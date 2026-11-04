"use client"

import { useState } from "react"
import { Stack, WarningCircle } from "@phosphor-icons/react"
import { MOVEMENT_KINDS, type LowStock, type Movement, type MovementKind } from "../domain/inventory"
import { count, dateTime, plural } from "../../shared/ui/format"
import { Async, Badge, Card, Chips, Pager, Search, useDebounced, useLoad } from "../../shared/ui/parts"
import { DataTable, type Column } from "../../shared/ui/data-table"
import { useSession } from "../../shared/ui/admin-context"
import { useInventoryPort } from "./use-inventory"

const MOVEMENT: Record<MovementKind, string> = { manual: "Ajuste manual", sale: "Venta", cancel: "Devolución", import: "Importación" }
const delta = (n: number | null) => n == null ? "—" : n > 0 ? `+${count(n)}` : count(n)
const LOW: Column<LowStock>[] = [
  { key: "title", label: "Producto", render: p => <span className="block min-w-0"><span className="block max-w-72 truncate font-semibold">{p.title}</span><span className="block text-xs muted">{p.sku ?? "Sin SKU"}</span></span> },
  { key: "stock", label: "Existencias", numeric: true, render: p => <Badge tone={p.stockQuantity === 0 ? "bad" : "warn"}>{count(p.stockQuantity)}</Badge> },
  { key: "demand", label: "Vendidas en 180 días", numeric: true, render: p => count(p.unitsLast180Days) },
  { key: "backorders", label: "Venta sin existencias", desktopOnly: true, render: p => <span className="muted">{p.backorders === "no" ? "No permitida" : "Permitida"}</span> },
]

export function InventorySection() {
  const api = useInventoryPort()
  const { openOrder, version } = useSession()
  const [threshold, setThreshold] = useState(5)
  const [kind, setKind] = useState<MovementKind | "">(""), [q, setQ] = useState(""), [offset, setOffset] = useState(0)
  const limit = useDebounced(threshold), query = useDebounced(q)
  const low = useLoad(() => api.lowStock(limit), [limit, version])
  const moves = useLoad(() => api.movements(kind, query, offset), [kind, query, offset, version])
  const MOVES: Column<Movement>[] = [
    { key: "date", label: "Fecha", render: m => <span className="muted whitespace-nowrap">{dateTime(m.createdAt)}</span> },
    { key: "product", label: "Producto", render: m => <span className="block min-w-0"><span className="block max-w-64 truncate font-semibold">{m.title}</span><span className="block text-xs muted">{m.sku ?? "Sin SKU"}</span></span> },
    { key: "kind", label: "Tipo", render: m => <Badge tone={m.kind === "sale" ? "info" : m.kind === "cancel" ? "good" : "neutral"}>{MOVEMENT[m.kind]}</Badge> },
    { key: "delta", label: "Cambio", numeric: true, render: m => delta(m.quantityDelta) },
    { key: "after", label: "Saldo", numeric: true, desktopOnly: true, render: m => m.quantityAfter == null ? "—" : count(m.quantityAfter) },
    { key: "reason", label: "Motivo", render: m => <span>{m.orderId ? <button type="button" className="glass-link" onClick={e => { e.stopPropagation(); openOrder(m.orderId!) }}>{m.reason}</button> : m.reason}{m.actor && <span className="block text-xs muted">{m.actor}</span>}</span> },
  ]
  return <div className="glass-scroll">
    <Card icon={WarningCircle} title="Por reponer" subtitle="Productos publicados con control de existencias en el umbral o por debajo, los más vendidos primero"
      actions={<label className="glass-inline-field">Umbral<input type="number" min={0} max={999} className="glass-field" value={threshold} onChange={e => setThreshold(Math.max(0, Number(e.target.value) || 0))} /></label>}>
      <div className="mt-4"><Async state={low} label="Cargando productos por reponer" empty={{ icon: Stack, title: "Ningún producto está en el umbral o por debajo", hint: "Sube el umbral para ver más.", when: d => d.length === 0 }}>{d => <>
        <DataTable caption="Productos por reponer" rows={d} columns={LOW} />
        <p className="mt-4 text-xs text-stone-500">{plural(d.length, "producto", "productos")} por reponer</p>
      </>}</Async></div>
    </Card>
    <Card icon={Stack} title="Movimientos de inventario" subtitle="Ventas, devoluciones y ajustes manuales con su motivo">
      <div className="mt-4 grid gap-4">
        <Chips label="Tipo de movimiento" value={kind} onChange={v => { setKind(v); setOffset(0) }} options={[{ value: "", label: "Todos" }, ...MOVEMENT_KINDS.map(k => ({ value: k, label: MOVEMENT[k] }))]} />
        <div className="glass-filters"><Search value={q} onChange={v => { setQ(v); setOffset(0) }} label="Buscar producto o SKU" /></div>
      </div>
      <div className="mt-4"><Async state={moves} label="Cargando movimientos" rows={6} empty={{ icon: Stack, title: "Sin movimientos con este filtro", when: d => d.items.length === 0 }}>{d => <>
        <DataTable caption="Movimientos de inventario" rows={d.items} columns={MOVES} />
        <Pager offset={offset} total={d.total} onChange={setOffset} />
      </>}</Async></div>
    </Card>
  </div>
}

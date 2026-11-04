"use client"

import { useState } from "react"
import { Stack, WarningCircle } from "@phosphor-icons/react"
import { MOVEMENT_KINDS, type MovementKind } from "../domain/inventory"
import { count, dateTime, plural } from "../../shared/ui/format"
import { Async, Badge, Card, Pager, Search, useDebounced, useLoad } from "../../shared/ui/parts"
import { Segmented } from "../../shared/ui/rich"
import { useSession } from "../../shared/ui/admin-context"
import { useInventoryPort } from "./use-inventory"

const MOVEMENT: Record<MovementKind, string> = { manual: "Ajuste manual", sale: "Venta", cancel: "Devolución", import: "Importación" }
const delta = (n: number | null) => n == null ? "—" : n > 0 ? `+${count(n)}` : count(n)

export function InventorySection() {
  const api = useInventoryPort()
  const { openOrder, version } = useSession()
  const [view, setView] = useState<"low" | "movements">("low")
  const [threshold, setThreshold] = useState(5)
  const [kind, setKind] = useState<MovementKind | "">(""), [q, setQ] = useState(""), [offset, setOffset] = useState(0)
  const limit = useDebounced(threshold), query = useDebounced(q)
  const low = useLoad(() => api.lowStock(limit), [limit, version])
  const moves = useLoad(() => api.movements(kind, query, offset), [kind, query, offset, version])
  return <div className="glass-scroll inventory-workspace">
    <div className="inventory-switch"><Segmented label="Vista de inventario" value={view} onChange={setView} options={[{ value: "low", label: "Por reponer", icon: WarningCircle }, { value: "movements", label: "Movimientos", icon: Stack }]} /></div>
    {view === "low" ? <Card className="inventory-card" icon={WarningCircle} title="Por reponer" subtitle="Productos publicados con control de existencias en el umbral o por debajo, los más vendidos primero"
      actions={<label className="glass-inline-field">Umbral<input type="number" min={0} max={999} className="glass-field" value={threshold} onChange={e => setThreshold(Math.max(0, Number(e.target.value) || 0))} /></label>}>
      <div className="mt-4"><Async state={low} label="Cargando productos por reponer" empty={{ icon: Stack, title: "Ningún producto está en el umbral o por debajo", hint: "Sube el umbral para ver más.", when: d => d.length === 0 }}>{d => <>
        <ul className="inventory-list" aria-label="Productos por reponer">{d.map(p => <li key={p.id} className="inventory-row">
          <div className="inventory-product"><strong>{p.title}</strong><span>{p.sku ?? "Sin SKU"}</span></div>
          <dl className="inventory-values"><div><dt>Existencias</dt><dd><Badge tone={p.stockQuantity === 0 ? "bad" : "warn"}>{count(p.stockQuantity)}</Badge></dd></div><div><dt>Vendidas en 180 días</dt><dd>{count(p.unitsLast180Days)}</dd></div><div><dt>Venta sin existencias</dt><dd>{p.backorders === "no" ? "No permitida" : "Permitida"}</dd></div></dl>
        </li>)}</ul>
        <p className="mt-4 text-xs text-stone-500">{plural(d.length, "producto", "productos")} por reponer</p>
      </>}</Async></div>
    </Card>
    : <Card className="inventory-card" icon={Stack} title="Movimientos de inventario" subtitle="Ventas, devoluciones y ajustes manuales con su motivo">
      <div className="inventory-filters mt-4">
        <Search value={q} onChange={v => { setQ(v); setOffset(0) }} label="Buscar producto o SKU" />
        <label className="glass-label">Tipo de movimiento<select className="glass-field inventory-select" value={kind} onChange={e => { setKind(e.target.value as MovementKind | ""); setOffset(0) }}><option value="">Todos</option>{MOVEMENT_KINDS.map(k => <option key={k} value={k}>{MOVEMENT[k]}</option>)}</select></label>
      </div>
      <div className="mt-4"><Async state={moves} label="Cargando movimientos" rows={6} empty={{ icon: Stack, title: "Sin movimientos con este filtro", when: d => d.items.length === 0 }}>{d => <>
        <Pager offset={offset} total={d.total} onChange={setOffset} />
        <ul className="inventory-list" aria-label="Movimientos de inventario">{d.items.map(m => <li key={m.id} className="inventory-row">
          <div className="inventory-product"><strong>{m.title}</strong><span>{m.sku ?? "Sin SKU"}</span></div>
          <dl className="inventory-values"><div><dt>Fecha</dt><dd>{dateTime(m.createdAt)}</dd></div><div><dt>Tipo</dt><dd><Badge tone={m.kind === "sale" ? "info" : m.kind === "cancel" ? "good" : "neutral"}>{MOVEMENT[m.kind]}</Badge></dd></div><div><dt>Cambio</dt><dd>{delta(m.quantityDelta)}</dd></div><div><dt>Saldo</dt><dd>{m.quantityAfter == null ? "—" : count(m.quantityAfter)}</dd></div></dl>
          <div className="inventory-reason"><span>Motivo</span>{m.orderId ? <button type="button" className="glass-link" onClick={() => openOrder(m.orderId!)}>{m.reason}</button> : <p>{m.reason}</p>}{m.actor && <small>{m.actor}</small>}</div>
        </li>)}</ul>
      </>}</Async></div>
    </Card>}
  </div>
}

"use client"

import { useState, type FormEvent } from "react"
import { Percent, Plus } from "@phosphor-icons/react"
import type { TaxRate } from "../domain/catalog"
import { count } from "../../shared/ui/format"
import { Async, Badge, Card, useLoad } from "../../shared/ui/parts"
import { DataTable, type Column } from "../../shared/ui/data-table"
import { useSession } from "../../shared/ui/admin-context"
import { useCatalogPort } from "./use-catalog"

const emptyRate = { id: "", code: "", name: "", percent: "", active: true }
export function TaxSection() {
  const api = useCatalogPort()
  const { csrf, notify, changed } = useSession()
  const rates = useLoad(() => api.listTaxRates(), [])
  const [form, setForm] = useState(emptyRate), [busy, setBusy] = useState(false), [error, setError] = useState("")
  async function save(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError("")
    try { await api.saveTaxRate(form.id || null, { code: form.code.trim(), name: form.name.trim(), percent: Number(form.percent), active: form.active }, csrf); notify("Tasa guardada correctamente."); setForm(emptyRate); rates.reload(); changed() }
    catch (err) { setError(err instanceof Error ? err.message : "No se pudo guardar la tasa") } finally { setBusy(false) }
  }
  const columns: Column<TaxRate>[] = [
    { key: "name", label: "Nombre", primary: true, render: r => r.name },
    { key: "code", label: "Código", desktopOnly: true, render: r => <span className="muted">{r.code}</span> },
    { key: "percent", label: "Tasa", numeric: true, render: r => `${r.percent} %` },
    { key: "products", label: "Productos", numeric: true, render: r => count(r.products ?? 0) },
    { key: "state", label: "Estado", render: r => <Badge tone={r.active ? "good" : "neutral"}>{r.active ? "Activa" : "Inactiva"}</Badge> },
  ]
  const edit = (r: TaxRate) => { setError(""); setForm({ id: r.id, code: r.code, name: r.name, percent: String(r.percent), active: r.active }) }
  return <div className="glass-scroll"><div className="glass-split">
    <Card icon={Percent} title="Tasas de impuesto" subtitle="Los precios se guardan sin IVA; el cliente ve el precio con la tasa del producto">
      <div className="mt-4"><Async state={rates} label="Cargando tasas">{d => <DataTable caption="Tasas de impuesto" rows={d} columns={columns} onOpen={edit} />}</Async></div>
    </Card>
    <Card icon={Plus} title={form.id ? "Editar tasa" : "Nueva tasa"} subtitle="Una tasa en uso no puede cambiar de porcentaje: crea otra y reasigna los productos">
      {error && <p role="alert" className="glass-alert">{error}</p>}
      <form onSubmit={save} className="mt-4 grid gap-4">
        <label className="glass-label">Nombre<input className="glass-field" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="IVA 5 %" /></label>
        <label className="glass-label">Código<input className="glass-field" required pattern="[a-z0-9\-]{2,30}" value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toLowerCase() })} placeholder="iva-5" /></label>
        <label className="glass-label">Porcentaje<input className="glass-field" type="number" required min={0} max={99.99} step="0.01" value={form.percent} onChange={e => setForm({ ...form, percent: e.target.value })} /></label>
        <label className="glass-check"><input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} />Disponible para asignar a productos</label>
        <div className="flex flex-wrap gap-2"><button className="glass-cta" disabled={busy}>{busy ? "Guardando…" : "Guardar tasa"}</button>{form.id && <button type="button" className="glass-chip" onClick={() => setForm(emptyRate)}>Cancelar</button>}</div>
      </form>
    </Card>
  </div></div>
}

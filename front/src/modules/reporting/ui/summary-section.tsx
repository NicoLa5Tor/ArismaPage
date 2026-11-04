"use client"

import { useState } from "react"
import { ChartBar, Trophy, CreditCard, Receipt, Truck } from "@phosphor-icons/react"
import type { DateRange } from "../../shared/domain/page"
import { change, count, money, plural, shiftDay, today } from "../../shared/ui/format"
import { Async, Card, useLoad } from "../../shared/ui/parts"
import { useSession } from "../../shared/ui/admin-context"
import { SalesChart } from "./sales-chart"
import { Thumb } from "../../shared/ui/rich"
import { useReportsPort } from "./use-reports"

const PAYMENT: Record<string, string> = { payulatam: "PayU", wompi: "Wompi", cod: "Contra entrega", sin_metodo: "Sin método" }
/** First sale imported from WooCommerce was in May 2022. */
const FIRST_SALE = "2022-05-01"
const PRESETS: { id: string; label: string; range: () => DateRange }[] = [
  { id: "month", label: "Este mes", range: () => ({ from: `${today().slice(0, 7)}-01`, to: today() }) },
  { id: "90", label: "Últimos 90 días", range: () => ({ from: shiftDay(today(), -89), to: today() }) },
  { id: "year", label: "Este año", range: () => ({ from: `${today().slice(0, 4)}-01-01`, to: today() }) },
  { id: "last-year", label: "Año anterior", range: () => { const y = Number(today().slice(0, 4)) - 1; return { from: `${y}-01-01`, to: `${y}-12-31` } } },
  { id: "all", label: "Todo el historial", range: () => ({ from: FIRST_SALE, to: today() }) },
]

function RangePicker({ value, onChange }: { value: DateRange & { preset: string }; onChange: (v: DateRange & { preset: string }) => void }) {
  return <div className="glass-filters">
    <div className="glass-presets" role="group" aria-label="Periodo">{PRESETS.map(p => <button key={p.id} type="button" className="glass-preset" aria-pressed={value.preset === p.id} onClick={() => onChange({ ...p.range(), preset: p.id })}>{p.label}</button>)}</div>
    <div className="glass-dates">
      <label className="glass-label">Desde<input type="date" className="glass-field" value={value.from} max={value.to} onChange={e => e.target.value && onChange({ ...value, from: e.target.value, preset: "custom" })} /></label>
      <label className="glass-label">Hasta<input type="date" className="glass-field" value={value.to} min={value.from} max={today()} onChange={e => e.target.value && onChange({ ...value, to: e.target.value, preset: "custom" })} /></label>
    </div>
  </div>
}

function Kpi({ label, value, current, previous, hint }: { label: string; value: string; current?: number; previous?: number; hint?: string }) {
  const delta = current == null || previous == null ? null : change(current, previous)
  return <div className="glass-kpi"><span>{label}</span><strong>{value}</strong>
    {delta != null ? <small><b data-dir={delta > 0 ? "up" : delta < 0 ? "down" : undefined}>{delta > 0 ? "↑" : delta < 0 ? "↓" : "="} {Math.abs(delta).toLocaleString("es-CO")} %</b> frente al periodo anterior</small> : hint ? <small>{hint}</small> : null}</div>
}

/** Horizontal bars for a ranking; the label and value are always visible text, the bar only adds proportion. */
function Meter({ rows }: { rows: { key: string; label: string; value: number; detail: string }[] }) {
  const max = Math.max(...rows.map(r => r.value), 1)
  return <div className="glass-meter">{rows.map(r => <div key={r.key}><span className="truncate">{r.label}</span><i aria-hidden="true"><b style={{ width: `${r.value / max * 100}%` }} /></i><span className="text-right">{money(r.value)}<span className="block text-xs text-stone-500">{r.detail}</span></span></div>)}</div>
}

export function SummarySection() {
  const api = useReportsPort()
  const { go, version, openProduct } = useSession()
  const [range, setRange] = useState(() => ({ ...PRESETS[2].range(), preset: "year" }))
  const key = [range.from, range.to, version]
  const summary = useLoad(() => api.summary(range), key)
  // Monthly bars need several months to say anything; short ranges widen to the twelve months before "to".
  const widened = shiftDay(range.to, -330) < range.from
  const chartRange = widened ? { from: shiftDay(range.to, -364), to: range.to } : range
  const months = useLoad(() => api.salesByMonth(chartRange), [chartRange.from, chartRange.to, version])
  const top = useLoad(() => api.topProducts(range, 8), key)
  const payments = useLoad(() => api.paymentMethods(range), key)
  const shipping = useLoad(() => api.shippingMethods(range), key)

  return <div className="glass-scroll">
    <RangePicker value={range} onChange={setRange} />
    <Async state={summary} label="Cargando resumen" rows={2}>{s => <div className="glass-kpis">
      <Kpi label="Ventas pagadas" value={money(s.sales)} current={s.sales} previous={s.previous.sales} />
      <Kpi label="Pedidos pagados" value={count(s.orders)} current={s.orders} previous={s.previous.orders} />
      <Kpi label="Ticket promedio" value={money(s.avgTicket)} current={s.avgTicket} previous={s.previous.avgTicket} />
      <Kpi label="Unidades vendidas" value={count(s.units)} current={s.units} previous={s.previous.units} />
      <Kpi label="Clientes nuevos" value={count(s.newCustomers)} hint="Primera compra en el periodo" />
      <Kpi label="IVA cobrado" value={money(s.tax)} hint={`Envíos cobrados ${money(s.shipping)}`} />
    </div>}</Async>
    {summary.data && summary.data.queue.toDispatch > 0 && <div className="glass-banner" role="status"><span className="flex items-center gap-2"><Receipt size={18} aria-hidden="true" />{plural(summary.data.queue.toDispatch, "pedido pagado espera", "pedidos pagados esperan")} despacho.</span><button type="button" className="glass-chip" onClick={() => go("orders", { vista: "tablero" })}>Abrir tablero de pedidos</button></div>}
    <Card icon={ChartBar} title="Ventas por mes" subtitle={widened ? "Últimos doce meses hasta la fecha final elegida" : "Pedidos pagados: procesando, completados y en espera"}>
      <Async state={months} label="Cargando ventas por mes" empty={{ icon: ChartBar, title: "Sin ventas en este periodo", when: d => d.every(m => m.sales === 0) }}>{d => <SalesChart data={d} />}</Async>
    </Card>
    <div className="glass-split">
      <Card icon={Trophy} title="Más vendidos" subtitle="Por unidades en el periodo">
        <Async state={top} label="Cargando más vendidos" empty={{ icon: Trophy, title: "Aún no hay ventas en este periodo", when: d => d.length === 0 }}>{d => <ol className="glass-ranking">{d.map((p, i) => <li key={p.productId ?? p.title} data-clickable={p.productId ? "" : undefined} onClick={() => p.productId && openProduct(p.productId)}>
          <span className="glass-rank" aria-hidden="true">{i + 1}</span><Thumb image={{ productId: p.productId, imageId: p.imageId, imageUrl: p.imageUrl, imageUploaded: p.imageUploaded }} size={40} />
          <span className="min-w-0 flex-1">{p.productId ? <button type="button" className="glass-row-link block max-w-full truncate" title={p.title} onClick={e => { e.stopPropagation(); openProduct(p.productId!) }}>{p.title}</button> : <span className="block truncate font-semibold" title={p.title}>{p.title}</span>}<span className="block truncate text-xs text-stone-500">{p.sku ?? "Sin SKU"} · {p.stockQuantity == null ? "sin control de existencias" : `${count(p.stockQuantity)} en existencia`}</span></span>
          <span className="text-right tabular-nums"><span className="block font-semibold">{plural(p.units, "ud", "uds")}</span><span className="block text-xs text-stone-500">{money(p.net)} sin IVA</span></span>
        </li>)}</ol>}</Async>
      </Card>
      <div className="grid content-start gap-4">
        <Card icon={CreditCard} title="Medios de pago" subtitle="Ventas pagadas por pasarela">
          <Async state={payments} label="Cargando medios de pago" empty={{ icon: CreditCard, title: "Sin pagos en este periodo", when: d => d.length === 0 }}>{d => <Meter rows={d.map(m => ({ key: m.method, label: PAYMENT[m.method] ?? m.title, value: m.sales, detail: plural(m.orders, "pedido", "pedidos") }))} />}</Async>
        </Card>
        <Card icon={Truck} title="Envíos" subtitle="Método elegido y lo cobrado por envío">
          <Async state={shipping} label="Cargando envíos" empty={{ icon: Truck, title: "Sin envíos en este periodo", when: d => d.length === 0 }}>{d => <Meter rows={d.map(m => ({ key: m.method, label: m.label || m.method, value: m.cost, detail: plural(m.orders, "pedido", "pedidos") }))} />}</Async>
        </Card>
      </div>
    </div>
  </div>
}

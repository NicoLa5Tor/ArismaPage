"use client"

import { useState } from "react"
import { count, money, moneyShort } from "../../shared/ui/format"
import type { MonthSales } from "../domain/reports"

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
const label = (month: string) => { const [y, m] = month.split("-"); return `${MONTHS[Number(m) - 1]} ${y.slice(2)}` }
/** Round the axis maximum up to 1, 2 or 5 × 10ⁿ so gridlines land on readable values. */
function niceMax(v: number) { if (v <= 0) return 1; const p = 10 ** Math.floor(Math.log10(v)); return [1, 2, 5, 10].map(f => f * p).find(n => n >= v) ?? v }

/** Monthly paid sales as a single-series bar chart. Hover or focus a bar for the exact values; a table carries the same data. */
export function SalesChart({ data }: { data: MonthSales[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 720, H = 240, L = 56, B = 24, T = 8
  const max = niceMax(Math.max(...data.map(d => d.sales), 0))
  const step = (W - L) / Math.max(data.length, 1), bar = Math.max(2, Math.min(32, step - 2))
  const y = (v: number) => T + (H - T - B) * (1 - v / max)
  const every = Math.ceil(data.length / 12)
  const active = hover == null ? null : data[hover]
  return <div className="glass-chart">
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Ventas por mes, ${data.length} meses`} onMouseLeave={() => setHover(null)}>
      {[0, 0.5, 1].map(f => <g key={f}><line className="grid" x1={L} x2={W} y1={y(max * f)} y2={y(max * f)} /><text x={L - 8} y={y(max * f) + 4} textAnchor="end">{moneyShort(max * f)}</text></g>)}
      {data.map((d, i) => {
        const x = L + i * step + (step - bar) / 2, top = y(d.sales), h = Math.max(0, H - B - top), r = Math.min(4, bar / 2, h)
        return <g key={d.month} tabIndex={0} aria-label={`${label(d.month)}: ${money(d.sales)}, ${d.orders} pedidos`} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}>
          <rect className="bar-hit" x={L + i * step} y={T} width={step} height={H - T - B} />
          {h > 0 && <path className="bar" d={`M${x},${H - B} V${top + r} q0,-${r} ${r},-${r} H${x + bar - r} q${r},0 ${r},${r} V${H - B} Z`} />}
          {i % every === 0 && <text x={x + bar / 2} y={H - 6} textAnchor="middle">{label(d.month)}</text>}
        </g>
      })}
    </svg>
    {active && hover != null && <div className="glass-tooltip" style={{ left: `${(L + hover * step + step / 2) / W * 100}%`, top: `${y(active.sales) / H * 100}%` }}><b>{money(active.sales)}</b>{label(active.month)} · {count(active.orders)} pedidos</div>}
    <table className="sr-only"><caption>Ventas pagadas por mes</caption><thead><tr><th>Mes</th><th>Pedidos</th><th>Ventas</th></tr></thead><tbody>{data.map(d => <tr key={d.month}><td>{label(d.month)}</td><td>{d.orders}</td><td>{money(d.sales)}</td></tr>)}</tbody></table>
  </div>
}

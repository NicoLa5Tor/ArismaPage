"use client"

import { useState } from "react"
import { FileText } from "@phosphor-icons/react"
import { QUOTE_STATUSES, type QuoteRow, type QuoteStatus } from "../domain/quotes"
import { count, date, money, plural } from "../../shared/ui/format"
import { Async, Card, Chips, Pager, Search, useDebounced, useLoad } from "../../shared/ui/parts"
import { DataTable, type Column } from "../../shared/ui/data-table"
import { useSession } from "../../shared/ui/admin-context"
import { QUOTE_STATUS, QuoteBadge } from "./labels"
import { useQuotesPort } from "./use-quotes"

const COLUMNS: Column<QuoteRow>[] = [
  { key: "number", label: "Cotización", primary: true, render: r => <span>{r.number}{r.orderNumber && <span className="block text-xs font-normal muted">Pedido #{r.orderNumber}</span>}</span> },
  { key: "date", label: "Fecha", render: r => <span className="muted whitespace-nowrap">{date(r.createdAt)}</span> },
  { key: "who", label: "Solicitante", render: r => <span className="block min-w-0"><span className="block max-w-56 truncate">{r.name || "Sin nombre"}</span><span className="block max-w-56 truncate text-xs muted">{r.email}</span></span> },
  { key: "status", label: "Estado", render: r => <QuoteBadge status={r.status} overdue={r.overdue} /> },
  { key: "units", label: "Unidades", numeric: true, desktopOnly: true, render: r => count(r.units) },
  { key: "total", label: "Valor con IVA", numeric: true, render: r => <span className="font-semibold">{money(r.total)}</span> },
]

export function QuotesSection() {
  const api = useQuotesPort()
  const { openQuote, version } = useSession()
  const [status, setStatus] = useState<QuoteStatus | "">(""), [q, setQ] = useState(""), [offset, setOffset] = useState(0)
  const query = useDebounced(q)
  const quotes = useLoad(() => api.list(status, query, offset), [status, query, offset, version])
  return <div className="glass-scroll"><Card icon={FileText} title="Solicitudes de cotización" subtitle={quotes.data ? plural(quotes.data.total, "cotización", "cotizaciones") : undefined}>
    <div className="mt-4 grid gap-4">
      <Chips label="Estado" value={status} onChange={v => { setStatus(v); setOffset(0) }} options={[{ value: "", label: "Todas" }, ...QUOTE_STATUSES.map(s => ({ value: s, label: QUOTE_STATUS[s] }))]} />
      <div className="glass-filters"><Search value={q} onChange={v => { setQ(v); setOffset(0) }} label="Buscar por número, nombre o correo" /></div>
    </div>
    <div className="mt-4"><Async state={quotes} label="Cargando cotizaciones" rows={6} empty={{ icon: FileText, title: "No hay cotizaciones con este filtro", when: d => d.items.length === 0 }}>{d => <>
      <Pager offset={offset} total={d.total} onChange={setOffset} />
      <DataTable caption="Cotizaciones" rows={d.items} columns={COLUMNS} onOpen={r => openQuote(r.id)} />
    </>}</Async></div>
  </Card></div>
}

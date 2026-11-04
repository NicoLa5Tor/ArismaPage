"use client"

import { useState } from "react"
import { ArrowSquareOut, ChatCircleText, Package, Receipt, User } from "@phosphor-icons/react"
import { MANUAL_QUOTE_STATUSES, type QuoteDetail, type QuoteStatus } from "../domain/quotes"
import { count, date, dateTime, money, plural } from "../../shared/ui/format"
import { Badge, Dialog, Empty, Failure, Loading, useLoad, type Tone } from "../../shared/ui/parts"
import { Avatar, ContactActions, Panel, Row, Stat, TabPanel, Tabs, Thumb } from "../../shared/ui/rich"
import { useCan, useSession } from "../../shared/ui/admin-context"
import { QUOTE_STATUS, QuoteBadge } from "./labels"
import { useQuotesPort } from "./use-quotes"

type Tab = "products" | "request" | "notes"
const ACTION: Partial<Record<QuoteStatus, string>> = { accepted: "Marcar aceptada", rejected: "Rechazar", expired: "Marcar vencida", pending: "Volver a pendiente" }
/** "Vence en 3 días" / "Venció hace 2 días". */
function expiry(iso: string | null) {
  if (!iso) return "Sin fecha de vencimiento"
  const days = Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000)
  return days > 0 ? `Vence en ${plural(days, "día", "días")}` : days === 0 ? "Vence hoy" : `Venció hace ${plural(-days, "día", "días")}`
}
/** Whether current stock covers the requested quantity. */
function coverage(l: QuoteDetail["lines"][number]): { text: string; tone: Tone } {
  if (!l.productId) return { text: "Ya no está en el catálogo", tone: "neutral" }
  if (!l.manageStock) return l.stockStatus === "outofstock" ? { text: "Agotado", tone: "bad" } : { text: "Sin control de existencias", tone: "neutral" }
  const stock = l.stockQuantity ?? 0
  return stock >= l.quantity ? { text: `Alcanza (${count(stock)} en existencia)`, tone: "good" } : { text: `Faltan ${count(l.quantity - stock)}`, tone: stock > 0 ? "warn" : "bad" }
}

export function QuoteDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const api = useQuotesPort()
  const { csrf, notify, openOrder, openCustomer, openProduct, changed } = useSession()
  const quote = useLoad(() => api.get(id), [id])
  const canManage = useCan()("QUOTES_MANAGE")
  const [tab, setTab] = useState<Tab>("products")
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [note, setNote] = useState("")
  const q = quote.data

  async function move(status: QuoteStatus) {
    setBusy(true); setError("")
    try { await api.changeStatus(id, status, note, csrf); setNote(""); notify(`Cotización ${q?.number ?? ""} marcada como ${QUOTE_STATUS[status].toLowerCase()}.`); quote.reload(); changed() }
    catch (e) { setError(e instanceof Error ? e.message : "No se pudo cambiar el estado") } finally { setBusy(false) }
  }
  const tracked = q ? q.lines.filter(l => l.productId && l.manageStock) : []
  const covered = tracked.filter(l => coverage(l).tone === "good").length
  const units = q ? q.lines.reduce((a, l) => a + l.quantity, 0) : 0
  const footer = q && canManage && q.status !== "converted" ? <div className="glass-dialog-actions">
    <input className="glass-field glass-footer-note" value={note} onChange={e => setNote(e.target.value)} placeholder="Nota de seguimiento (opcional)" aria-label="Nota de seguimiento" />
    <span className="flex flex-wrap gap-2">{MANUAL_QUOTE_STATUSES.filter(s => s !== q.status && s !== "accepted").map(s => <button key={s} type="button" className={`glass-chip${s === "rejected" ? " glass-chip-danger" : ""}`} disabled={busy} onClick={() => void move(s)}>{ACTION[s]}</button>)}
      {q.status !== "accepted" && <button type="button" className="glass-cta" disabled={busy} onClick={() => void move("accepted")}>{busy ? "Guardando…" : ACTION.accepted}</button>}</span>
  </div> : undefined

  return <Dialog eyebrow="Cotización" title={q ? `Cotización ${q.number}` : "Cotización"} size="lg" busy={busy} onClose={onClose} footer={footer}
    media={q ? <Avatar name={q.name || q.email || "?"} size={52} /> : undefined}
    meta={q ? <><QuoteBadge status={q.status} overdue={q.overdue} /><span>{dateTime(q.createdAt)}</span><span>{q.name || "Sin nombre"}</span></> : undefined}>
    {quote.error ? <Failure message={quote.error} onRetry={quote.reload} /> : !q ? <Loading label="Cargando cotización" rows={5} /> : <div className="grid gap-6">
      <div className="glass-stats">
        <Stat label="Valor estimado" value={money(q.total)} hint={q.taxTotal ? `IVA ${money(q.taxTotal)}` : undefined} />
        <Stat label="Productos" value={plural(units, "unidad", "unidades")} hint={plural(q.lines.length, "referencia", "referencias")} />
        <Stat label="Existencias" value={tracked.length ? `${covered} de ${tracked.length}` : "—"} hint={tracked.length ? "referencias que alcanzan hoy" : "sin control de existencias"} />
        <Stat label="Vencimiento" value={q.expiresAt ? date(q.expiresAt) : "—"} hint={q.status === "pending" ? expiry(q.expiresAt) : QUOTE_STATUS[q.status]} />
      </div>
      {q.orderId && <p className="glass-banner"><span className="flex items-center gap-2"><Receipt size={16} aria-hidden="true" />Esta cotización se convirtió en el pedido #{q.orderNumber}.</span><button type="button" className="glass-chip" onClick={() => openOrder(q.orderId!)}>Ver pedido</button></p>}
      <ContactActions email={q.email} phone={q.phone} message={`Hola ${q.name.split(" ")[0] ?? ""}, te escribimos de Arisma sobre tu cotización ${q.number}.`} />
      {error && <p role="alert" className="glass-alert">{error}</p>}
      <Tabs label="Detalle de la cotización" value={tab} onChange={setTab} tabs={[{ id: "products", label: "Productos", badge: q.lines.length }, { id: "request", label: "Solicitud" }, { id: "notes", label: "Notas", badge: q.notes.length || undefined }]} />

      <TabPanel active={tab === "products"}>{q.lines.length === 0 ? <Empty icon={Package} title="La solicitud no tiene productos" /> : <ul className="glass-lines">{q.lines.map(l => { const cov = coverage(l); return <li key={l.id}>
        <Thumb image={{ productId: l.productId, imageId: l.imageId, imageUrl: l.imageUrl, imageUploaded: l.imageUploaded }} size={56} />
        <div className="min-w-0 flex-1"><p className="font-semibold">{l.productId ? <button type="button" className="glass-row-link" onClick={() => openProduct(l.productId!)}>{l.title}<ArrowSquareOut size={12} aria-hidden="true" className="ml-1 inline" /></button> : l.title}</p>
          <p className="text-xs text-stone-500">{l.sku ?? "Sin SKU"} · {count(l.quantity)} × {money(l.unitPrice)} sin IVA</p><p className="mt-1"><Badge tone={cov.tone}>{cov.text}</Badge></p></div>
        <p className="text-right font-semibold tabular-nums">{money(l.total)}<span className="block text-xs font-normal text-stone-500">sin IVA</span></p>
      </li> })}</ul>}</TabPanel>

      <TabPanel active={tab === "request"}><div className="glass-panels">
        <Panel icon={User} title="Solicitante" action={q.customerId ? <button type="button" className="glass-chip" onClick={() => openCustomer(q.customerId!)}>Ver ficha</button> : undefined}>
          <dl className="glass-rows"><Row label="Nombre">{q.name}</Row><Row label="Correo">{q.email}</Row><Row label="Teléfono">{q.phone}</Row><Row label="Solicitada">{dateTime(q.createdAt)}</Row></dl></Panel>
        <Panel icon={ChatCircleText} title="Mensaje"><p className="text-sm whitespace-pre-line">{q.message || "El cliente no dejó mensaje."}</p></Panel>
      </div></TabPanel>

      <TabPanel active={tab === "notes"}>{q.notes.length === 0 ? <p className="text-sm text-stone-500">Aún no hay notas. Agrega una desde la barra inferior al cambiar el estado.</p> :
        <ol className="glass-timeline">{[...q.notes].reverse().map(n => <li key={n.id} data-kind="note"><time dateTime={n.createdAt}>{dateTime(n.createdAt)}{n.author && ` · ${n.author}`}</time>{n.body}</li>)}</ol>}</TabPanel>
    </div>}
  </Dialog>
}

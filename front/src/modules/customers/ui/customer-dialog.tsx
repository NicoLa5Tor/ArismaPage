"use client"

import { useState } from "react"
import { departmentName } from "../../shared/domain/colombia"
import { FileText, IdentificationCard, MapPin, Receipt, Heart } from "@phosphor-icons/react"
import { fullName } from "../domain/customers"
import { count, date, money, plural } from "../../shared/ui/format"
import { Dialog, Empty, Failure, Loading, useLoad } from "../../shared/ui/parts"
import { Avatar, ContactActions, CopyButton, Panel, Row, Stat, TabPanel, Tabs, Thumb } from "../../shared/ui/rich"
import { useSession } from "../../shared/ui/admin-context"
import { OrderBadge, PAYMENT } from "../../sales/ui/labels"
import { QuoteBadge } from "../../quotes/ui/labels"
import { useCustomersPort } from "./use-customers"
import { useStoreProfile } from "../../shared/ui/store-profile"

type Tab = "orders" | "favorites" | "quotes" | "data"
const DOC: Record<string, string> = { cc: "Cédula", NIT: "NIT", extranjeria: "Cédula de extranjería" }
/** Days since the last purchase, in words. */
function since(iso: string | null) {
  if (!iso) return "Nunca ha comprado"
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  return days < 1 ? "Compró hoy" : days < 31 ? `Hace ${plural(days, "día", "días")}` : days < 365 ? `Hace ${plural(Math.floor(days / 30), "mes", "meses")}` : `Hace ${plural(Math.floor(days / 365), "año", "años")}`
}

export function CustomerDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const profile = useStoreProfile()
  const api = useCustomersPort()
  const { openOrder, openQuote, openProduct } = useSession()
  const customer = useLoad(() => api.get(id), [id])
  const [tab, setTab] = useState<Tab>("orders")
  const c = customer.data
  const name = c ? fullName(c) : "Cliente"
  const avg = c && c.paidOrders ? Math.round(c.totalSpent / c.paidOrders) : 0
  return <Dialog eyebrow="Cliente" title={name} size="lg" onClose={onClose} media={c ? <Avatar name={name} size={52} /> : undefined}
    meta={c ? <><span>{c.hasAccount ? `Cuenta desde ${date(c.createdAt)}` : "Compró como invitado"}</span>{c.email && <span>{c.email}</span>}</> : undefined}>
    {customer.error ? <Failure message={customer.error} onRetry={customer.reload} /> : !c ? <Loading label="Cargando cliente" rows={5} /> : <div className="grid gap-6">
      <div className="glass-stats">
        <Stat label="Pedidos pagados" value={count(c.paidOrders)} hint={plural(c.orders.length, "pedido en total", "pedidos en total")} />
        <Stat label="Total comprado" value={money(c.totalSpent)} />
        <Stat label="Ticket promedio" value={c.paidOrders ? money(avg) : "—"} />
        <Stat label="Última compra" value={c.lastOrderAt ? date(c.lastOrderAt) : "—"} hint={since(c.lastOrderAt)} />
      </div>
      <ContactActions email={c.email} phone={c.phone} message={`Hola ${c.firstName}, te escribimos de ${profile.shortName}.`} />
      <Tabs label="Información del cliente" value={tab} onChange={setTab} tabs={[{ id: "orders", label: "Pedidos", badge: c.orders.length }, { id: "favorites", label: "Lo que más compra" }, { id: "quotes", label: "Cotizaciones", badge: c.quotes.length || undefined }, { id: "data", label: "Datos" }]} />

      <TabPanel active={tab === "orders"}>{c.orders.length === 0 ? <Empty icon={Receipt} title="Este cliente aún no tiene pedidos" /> :
        <ul className="glass-lines">{c.orders.map(o => <li key={o.id}><button type="button" className="glass-line-button" onClick={() => openOrder(o.id)}>
          <span className="glass-panel-icon"><Receipt size={16} aria-hidden="true" /></span>
          <span className="min-w-0 flex-1"><span className="block font-semibold">Pedido #{o.number}</span><span className="block text-xs text-stone-500">{date(o.placedAt)} · {plural(o.units, "unidad", "unidades")}{o.paymentMethod && ` · ${PAYMENT[o.paymentMethod] ?? o.paymentMethod}`}</span></span>
          <OrderBadge status={o.status} /><span className="w-28 text-right font-semibold tabular-nums">{money(o.total)}</span></button></li>)}</ul>}</TabPanel>

      <TabPanel active={tab === "favorites"}>{c.topProducts.length === 0 ? <Empty icon={Heart} title="Sin compras pagadas todavía" /> :
        <ul className="glass-lines">{c.topProducts.map(p => <li key={p.productId ?? p.title}><button type="button" className="glass-line-button" disabled={!p.productId} onClick={() => p.productId && openProduct(p.productId)}>
          <Thumb image={{ productId: p.productId, imageId: p.imageId, imageUrl: p.imageUrl, imageUploaded: p.imageUploaded }} size={48} />
          <span className="min-w-0 flex-1 truncate font-semibold">{p.title}</span><span className="text-right tabular-nums"><span className="block font-semibold">{plural(p.units, "unidad", "unidades")}</span><span className="block text-xs text-stone-500">{money(p.total)} sin IVA</span></span></button></li>)}</ul>}</TabPanel>

      <TabPanel active={tab === "quotes"}>{c.quotes.length === 0 ? <Empty icon={FileText} title="No ha pedido cotizaciones" /> :
        <ul className="glass-lines">{c.quotes.map(q => <li key={q.id}><button type="button" className="glass-line-button" onClick={() => openQuote(q.id)}>
          <span className="glass-panel-icon"><FileText size={16} aria-hidden="true" /></span><span className="min-w-0 flex-1"><span className="block font-semibold">{q.number}</span><span className="block text-xs text-stone-500">{date(q.createdAt)}</span></span>
          <QuoteBadge status={q.status} /><span className="w-28 text-right font-semibold tabular-nums">{money(q.total)}</span></button></li>)}</ul>}</TabPanel>

      <TabPanel active={tab === "data"}><div className="glass-panels">
        <Panel icon={IdentificationCard} title="Identificación"><dl className="glass-rows">
          <Row label="Documento">{c.documentNumber && <span className="flex items-center gap-2">{DOC[c.documentType ?? ""] ?? c.documentType} {c.documentNumber}<CopyButton value={c.documentNumber} label="documento" /></span>}</Row>
          <Row label="Empresa">{c.company}</Row><Row label="Correo">{c.email && <span className="flex items-center gap-2"><span className="truncate">{c.email}</span><CopyButton value={c.email} label="correo" /></span>}</Row>
          <Row label="Teléfono">{c.phone && <span className="flex items-center gap-2">{c.phone}<CopyButton value={c.phone} label="teléfono" /></span>}</Row></dl></Panel>
        {(c.book ?? []).map(a => <Panel key={a.id} icon={MapPin} title={`${a.label === "casa" ? "Casa" : a.label === "trabajo" ? "Trabajo" : "Otra dirección"}${a.isDefault ? " · predeterminada" : ""}`}><dl className="glass-rows">
          <Row label="Recibe">{a.recipient}</Row><Row label="Dirección">{[a.street, a.detail].filter(Boolean).join(", ")}</Row><Row label="Barrio">{a.neighborhood}</Row>
          <Row label="Ciudad">{[a.city, departmentName(a.state)].filter(Boolean).join(", ")}</Row><Row label="Teléfono">{a.phone}</Row><Row label="Indicaciones">{a.instructions}</Row></dl></Panel>)}
        {c.addresses.map(a => <Panel key={a.kind} icon={MapPin} title={a.kind === "billing" ? "Dirección de facturación (tienda anterior)" : "Dirección de envío (tienda anterior)"}><dl className="glass-rows">
          <Row label="Recibe">{[a.firstName, a.lastName].filter(Boolean).join(" ")}</Row><Row label="Dirección">{[a.line1, a.line2].filter(Boolean).join(", ")}</Row><Row label="Ciudad">{[a.city, departmentName(a.state)].filter(Boolean).join(", ")}</Row><Row label="Teléfono">{a.phone}</Row></dl></Panel>)}
      </div></TabPanel>
    </div>}
  </Dialog>
}

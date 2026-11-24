"use client"

import { useMemo } from "react"
import { Receipt, WarningCircle, Images, CaretRight } from "@phosphor-icons/react"
import { count, money, plural, today } from "../../shared/ui/format"
import { useLoad } from "../../shared/ui/parts"
import { useSession } from "../../shared/ui/admin-context"
import { useReportsPort } from "../../reporting/ui/use-reports"
import { useStoreProfile } from "../../shared/ui/store-profile"

/** Right column: what needs attention now. Every count opens the matching filtered list. */
export function Pending() {
  const profile = useStoreProfile()
  const reports = useReportsPort()
  const { go, version } = useSession()
  const month = useMemo(() => { const t = today(); return { from: `${t.slice(0, 7)}-01`, to: t } }, [])
  const s = useLoad(() => reports.summary(month), [month.from, month.to, version])
  const q = s.data?.queue
  const link = (label: string, value: number | undefined, onClick: () => void) =>
    <button type="button" className="glass-widget-link" onClick={onClick}><span>{label}</span><span className="flex items-center gap-2"><b>{value == null ? "—" : count(value)}</b><CaretRight size={14} aria-hidden="true" /></span></button>
  return <>
    <section className="glass-window glass-widget glass-widget-blue"><div className="glass-widget-head"><span>Ventas del mes</span><Receipt size={20} aria-hidden="true" /></div>
      <strong>{s.data ? money(s.data.sales) : "—"}</strong>
      <p>{s.error ? "No se pudo cargar el resumen" : s.data ? (s.data.orders ? `${plural(s.data.orders, "pedido pagado", "pedidos pagados")} este mes` : "Aún no hay pedidos pagados este mes") : "Cargando…"}</p></section>
    <section className="glass-window glass-widget"><div className="glass-widget-head"><span>Por atender</span><WarningCircle size={20} aria-hidden="true" /></div>
      {(q?.cancelRequests ?? 0) > 0 && link("Piden cancelar", q?.cancelRequests, () => go("orders", { etapa: "cancel_request" }))}
      {(q?.refundsToTransfer ?? 0) > 0 && link("Reembolsos por transferir", q?.refundsToTransfer, () => go("orders", { etapa: "refund_pending" }))}
      {(q?.refundsToCheck ?? 0) > 0 && link("Reembolsos por revisar", q?.refundsToCheck, () => go("orders", { etapa: "refund_pending" }))}
      {(q?.refundsOwed ?? 0) > 0 && link("Cancelados sin reembolso", q?.refundsOwed, () => go("orders", { etapa: "cancelled" }))}
      {link("Por preparar o enviar", q?.toDispatch, () => go("orders", { vista: "tablero" }))}
      {link("En camino", q?.inTransit, () => go("orders", { etapa: "shipped" }))}
      {link("Requieren atención", q?.issues, () => go("orders", { etapa: "issue" }))}
      {link("Sin pagar", q?.unpaid, () => go("orders", { etapa: "unpaid" }))}
      {link("De la tienda sin pagar", q?.storeUnpaid, () => go("orders", { etapa: "unpaid" }))}
      {link("Opiniones por revisar", q?.reviewsPending, () => go("reviews"))}
      {link("Cotizaciones abiertas", q?.openQuotes, () => go("quotes"))}
      {link("Productos por reponer", q?.lowStock, () => go("inventory"))}
    </section>
    <section className="glass-window glass-widget glass-widget-dark"><div className="glass-widget-head"><span>Catálogo de {profile.shortName}</span><Images size={20} aria-hidden="true" /></div><div className="glass-product-scene" aria-hidden="true" /><p>Precios con IVA calculado desde la tasa de cada producto.</p><button type="button" className="glass-chip" onClick={() => go("products")}>Ver productos <span aria-hidden="true">→</span></button></section>
  </>
}

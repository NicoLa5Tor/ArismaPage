"use client"

import { useState, type FormEvent } from "react"
import { Ticket, Plus } from "@phosphor-icons/react"
import { COUPON_KINDS, couponKind, type Coupon, type CouponInput, type CouponKind } from "../domain/coupons"
import { count, date, money } from "../../shared/ui/format"
import { Async, Badge, Card, Dialog, useLoad } from "../../shared/ui/parts"
import { DataTable, type Column } from "../../shared/ui/data-table"
import { useCan, useSession } from "../../shared/ui/admin-context"
import { useCouponsPort } from "./use-coupons"

const COUPON_KIND: Record<CouponKind, string> = { FIXED_CART: "Valor fijo al carrito", PERCENT: "Porcentaje", FIXED_PRODUCT: "Valor fijo por producto" }
const emptyCoupon = { code: "", kind: "PERCENT" as CouponKind, amount: "", minimumAmount: "", maximumAmount: "", usageLimit: "", usageLimitPerCustomer: "", individualUse: false, freeShipping: false, excludeSaleItems: false, expiresAt: "", active: true, description: "" }
const opt = (v: string) => v === "" ? null : Number(v)
const s = (v: number | null) => v == null ? "" : String(v)

export function CouponsSection() {
  const api = useCouponsPort()
  const { csrf, notify } = useSession()
  const canEdit = useCan()("COUPONS_MANAGE")
  const coupons = useLoad(() => api.list(), [])
  const [editing, setEditing] = useState<string | null | undefined>(undefined)
  const [form, setForm] = useState(emptyCoupon), [busy, setBusy] = useState(false), [error, setError] = useState("")
  const open = (c?: Coupon) => { setError(""); setEditing(c?.id ?? null); setForm(c ? { code: c.code, kind: couponKind(c), amount: String(c.amount), minimumAmount: s(c.minimumAmount), maximumAmount: s(c.maximumAmount), usageLimit: s(c.usageLimit), usageLimitPerCustomer: s(c.usageLimitPerCustomer), individualUse: c.individualUse, freeShipping: c.freeShipping, excludeSaleItems: c.excludeSaleItems, expiresAt: c.expiresAt?.slice(0, 10) ?? "", active: c.active, description: c.description } : emptyCoupon) }
  async function save(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError("")
    const input: CouponInput = { ...form, amount: Number(form.amount), minimumAmount: opt(form.minimumAmount), maximumAmount: opt(form.maximumAmount), usageLimit: opt(form.usageLimit), usageLimitPerCustomer: opt(form.usageLimitPerCustomer), expiresAt: form.expiresAt ? new Date(`${form.expiresAt}T23:59:59-05:00`).toISOString() : null }
    try { await api.save(editing ?? null, input, csrf); notify("Cupón guardado correctamente."); setEditing(undefined); coupons.reload() } catch (err) { setError(err instanceof Error ? err.message : "No se pudo guardar el cupón") } finally { setBusy(false) }
  }
  const value = (c: Coupon) => c.kind === "percent" ? `${c.amount} %` : money(c.amount)
  const columns: Column<Coupon>[] = [
    { key: "code", label: "Código", primary: true, render: c => <span>{c.code}{c.description && <span className="block text-xs font-normal muted">{c.description}</span>}</span> },
    { key: "value", label: "Descuento", render: c => <span>{value(c)}<span className="block text-xs muted">{COUPON_KIND[couponKind(c)]}</span></span> },
    { key: "rules", label: "Condiciones", desktopOnly: true, render: c => <span className="muted">{[c.minimumAmount && `Mínimo ${money(c.minimumAmount)}`, c.expiresAt && `Vence ${date(c.expiresAt)}`, c.freeShipping && "Envío gratis", c.individualUse && "No acumulable"].filter(Boolean).join(" · ") || "Sin condiciones"}</span> },
    { key: "uses", label: "Usos", numeric: true, render: c => <>{count(c.uses)}{c.usageLimit && ` de ${count(c.usageLimit)}`}</> },
    { key: "discounted", label: "Descontado", numeric: true, render: c => money(c.discounted) },
    { key: "state", label: "Estado", render: c => <Badge tone={c.redeemable ? "good" : "neutral"}>{c.redeemable ? "Vigente" : c.active ? "Agotado o vencido" : "Inactivo"}</Badge> },
  ]
  return <div className="glass-scroll">
    <Card icon={Ticket} title="Cupones" subtitle="El uso cuenta solo pedidos pagados" actions={canEdit ? <button type="button" className="glass-cta" onClick={() => open()}><Plus size={16} aria-hidden="true" />Crear cupón</button> : undefined}>
      <div className="mt-4"><Async state={coupons} label="Cargando cupones" empty={{ icon: Ticket, title: "Aún no hay cupones", hint: "Crea el primero para una campaña.", when: d => d.length === 0 }}>{d => <DataTable caption="Cupones" rows={d} columns={columns} onOpen={canEdit ? open : undefined} />}</Async></div>
    </Card>
    {editing !== undefined && <Dialog eyebrow="Cupones" title={editing ? "Editar cupón" : "Crear cupón"} busy={busy} onClose={() => setEditing(undefined)}>
      {error && <p role="alert" className="glass-alert">{error}</p>}
      <form onSubmit={save} className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2"><label className="glass-label">Código<input className="glass-field" required minLength={3} maxLength={40} pattern="[\p{L}0-9_\-]+" value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="NAVIDAD10" /></label>
          <label className="glass-label">Tipo<select className="glass-field" value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value as CouponKind })}>{COUPON_KINDS.map(k => <option key={k} value={k}>{COUPON_KIND[k]}</option>)}</select></label>
          <label className="glass-label">{form.kind === "PERCENT" ? "Porcentaje" : "Valor sin IVA"}<input className="glass-field" type="number" required min={1} max={form.kind === "PERCENT" ? 100 : undefined} step="1" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></label>
          <label className="glass-label">Vence el<input className="glass-field" type="date" value={form.expiresAt} onChange={e => setForm({ ...form, expiresAt: e.target.value })} /></label>
          <label className="glass-label">Compra mínima sin IVA<input className="glass-field" type="number" min={0} value={form.minimumAmount} onChange={e => setForm({ ...form, minimumAmount: e.target.value })} /></label>
          <label className="glass-label">Compra máxima sin IVA<input className="glass-field" type="number" min={0} value={form.maximumAmount} onChange={e => setForm({ ...form, maximumAmount: e.target.value })} /></label>
          <label className="glass-label">Usos totales<input className="glass-field" type="number" min={1} value={form.usageLimit} onChange={e => setForm({ ...form, usageLimit: e.target.value })} placeholder="Sin límite" /></label>
          <label className="glass-label">Usos por cliente<input className="glass-field" type="number" min={1} value={form.usageLimitPerCustomer} onChange={e => setForm({ ...form, usageLimitPerCustomer: e.target.value })} placeholder="Sin límite" /></label></div>
        <label className="glass-label">Descripción interna<input className="glass-field" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label>
        {([["active", "Cupón activo"], ["individualUse", "No se acumula con otros cupones"], ["freeShipping", "Incluye envío gratis"], ["excludeSaleItems", "No aplica a productos en oferta"]] as const).map(([k, l]) => <label key={k} className="glass-check"><input type="checkbox" checked={form[k]} onChange={e => setForm({ ...form, [k]: e.target.checked })} />{l}</label>)}
        <div className="flex flex-wrap gap-2 pt-2"><button className="glass-cta" disabled={busy}>{busy ? "Guardando…" : "Guardar cupón"}</button><button type="button" className="glass-chip" disabled={busy} onClick={() => setEditing(undefined)}>Cancelar</button></div>
      </form>
    </Dialog>}
  </div>
}


"use client"

import { FormEvent, Suspense, useCallback, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { httpPorts, httpSession } from "../../modules/admin/adapters/http-ports"
import { AdminShell, SECTIONS, type AdminSection } from "../../modules/admin/ui/admin-shell"
import { Pending } from "../../modules/admin/ui/pending"
import { AdminProviders, type AdminSession } from "../../modules/shared/ui/admin-context"
import { AdminLogin } from "../../modules/identity/ui/admin-login"
import { AccountDialog, ForcedPasswordChange } from "../../modules/identity/ui/account"
import { UsersSection } from "../../modules/identity/ui/users-section"
import type { Session } from "../../modules/identity/application/session-port"
import { CategoriesSection } from "../../modules/catalog/ui/categories-section"
import { ProductsSection } from "../../modules/catalog/ui/products-section"
import { TaxSection } from "../../modules/catalog/ui/tax-section"
import { ProductEditor } from "../../modules/catalog/ui/product-editor"
import { CustomerDialog } from "../../modules/customers/ui/customer-dialog"
import { CustomersSection } from "../../modules/customers/ui/customers-section"
import { InventorySection } from "../../modules/inventory/ui/inventory-section"
import { CouponsSection } from "../../modules/promotions/ui/coupons-section"
import { QuoteDialog } from "../../modules/quotes/ui/quote-dialog"
import { QuotesSection } from "../../modules/quotes/ui/quotes-section"
import { SummarySection } from "../../modules/reporting/ui/summary-section"
import { OrderDialog } from "../../modules/sales/ui/order-dialog"
import { OrdersSection } from "../../modules/sales/ui/orders-section"

type Open = { kind: "order" | "customer" | "quote" | "product"; id: string }

/** Composition root: wires HTTP adapters into module ports and keeps the section and its filters in the URL. */
function Admin() {
  const router = useRouter(), params = useSearchParams()
  const [auth, setAuth] = useState<Session | null>(null), [ready, setReady] = useState(false)
  const csrf = auth?.csrf ?? ""
  const permissions = auth?.user.permissions
  // A section the role cannot use falls back to the summary, even when typed in the URL.
  // The former "Despachos" section is now the board view of Pedidos; old links keep working.
  const legacyDispatch = params.get("seccion") === "despachos"
  const requested = SECTIONS.find(s => s.slug === (legacyDispatch ? "pedidos" : params.get("seccion")))
  const section: AdminSection = requested && (!requested.permission || permissions?.includes(requested.permission)) ? requested.id : "summary"
  const [account, setAccount] = useState(false)
  const [email, setEmail] = useState(""), [password, setPassword] = useState("")
  const [error, setError] = useState(""), [notice, setNotice] = useState(""), [busy, setBusy] = useState(false)
  const [open, setOpen] = useState<Open[]>([])
  const [version, setVersion] = useState(0)

  useEffect(() => { httpSession.restore().then(s => { if (s) setAuth(s) }).finally(() => setReady(true)) }, [])
  // Confirmation messages leave on their own; errors stay until dismissed.
  useEffect(() => { if (!notice) return; const t = setTimeout(() => setNotice(""), 6000); return () => clearTimeout(t) }, [notice])

  const go = useCallback((id: string, extra: Record<string, string> = {}) => {
    const slug = SECTIONS.find(s => s.id === id)?.slug ?? "resumen"
    router.push(`/admin?${new URLSearchParams({ seccion: slug, ...extra })}`, { scroll: false })
    setError("")
  }, [router])
  const push = useCallback((kind: Open["kind"], id: string) => setOpen(o => [...o.filter(x => !(x.kind === kind && x.id === id)), { kind, id }]), [])
  const session = useMemo<AdminSession | null>(() => auth && ({
    csrf: auth.csrf, user: auth.user, version, changed: () => setVersion(v => v + 1), notify: m => { setError(""); setNotice(m) }, go, openAccount: () => setAccount(true),
    openOrder: id => push("order", id), openCustomer: id => push("customer", id), openQuote: id => push("quote", id), openProduct: id => push("product", id),
  }), [auth, version, go, push])

  async function login(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError(""); setNotice("")
    try { setAuth(await httpSession.login(email, password)); setPassword("") } catch (err) { setError(err instanceof Error ? err.message : "No se pudo iniciar sesión. Revisa tu conexión.") } finally { setBusy(false) }
  }
  async function logout() { try { await httpSession.logout(csrf) } catch { /* the session may already be gone */ } setAuth(null); setOpen([]); setAccount(false) }
  // After a password change the session is restored so the user record (mustChangePassword) and CSRF token are fresh.
  async function changePassword(current: string, next: string) { await httpSession.changePassword(current, next, csrf); const s = await httpSession.restore(); if (s) setAuth(s); setAccount(false); setNotice("Contraseña actualizada.") }

  if (!ready || !auth || !session) return <AdminLogin ready={ready} busy={busy} email={email} password={password} error={error} onEmailChange={setEmail} onPasswordChange={setPassword} onSubmit={login} />
  if (auth.user.mustChangePassword) return <ForcedPasswordChange user={auth.user} onChange={changePassword} onLogout={logout} />
  const close = (o: Open) => setOpen(list => list.filter(x => x !== o))
  return <AdminProviders session={session} ports={httpPorts}>
    <AdminShell section={section} onSectionChange={id => go(id)} onLogout={logout} aside={<Pending />} user={auth.user} onAccount={() => setAccount(true)}>
      {error && <div role="alert" className="glass-alert"><span>{error}</span><button type="button" className="glass-chip" onClick={() => setError("")}>Cerrar</button></div>}
      {section === "summary" && <SummarySection />}
      {section === "orders" && <OrdersSection key={params.get("etapa") ?? ""} initialStage={params.get("etapa") ?? ""} initialView={legacyDispatch ? "tablero" : params.get("vista") ?? "list"} />}
      {section === "customers" && <CustomersSection />}
      {section === "quotes" && <QuotesSection />}
      {section === "products" && <ProductsSection />}
      {section === "categories" && <CategoriesSection />}
      {section === "inventory" && <InventorySection />}
      {section === "coupons" && <CouponsSection />}
      {section === "settings" && <TaxSection />}
      {section === "users" && <UsersSection />}
    </AdminShell>
    <div className="glass-toast-region" aria-live="polite">{notice && <div role="status" className="glass-toast"><span>{notice}</span><button type="button" className="glass-chip" onClick={() => setNotice("")}>Cerrar</button></div>}</div>
    {open.map(o => o.kind === "order" ? <OrderDialog key={`o-${o.id}`} id={o.id} onClose={() => close(o)} />
      : o.kind === "customer" ? <CustomerDialog key={`c-${o.id}`} id={o.id} onClose={() => close(o)} />
      : o.kind === "product" ? <ProductEditor key={`p-${o.id}`} productId={o.id} onClose={() => close(o)} />
      : <QuoteDialog key={`q-${o.id}`} id={o.id} onClose={() => close(o)} />)}
    {account && <AccountDialog user={auth.user} onClose={() => setAccount(false)} onChange={changePassword} onLogout={logout} />}
  </AdminProviders>
}

export default function AdminPage() { return <Suspense fallback={null}><Admin /></Suspense> }

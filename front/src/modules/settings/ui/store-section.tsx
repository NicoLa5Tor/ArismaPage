"use client"

import { useState, type FormEvent } from "react"
import { ChatsCircle, Layout, Storefront, Truck } from "@phosphor-icons/react"
import { SECTIONS } from "../../catalog/domain/product-page"
import { useSession, usePort } from "../../shared/ui/admin-context"
import { Async, Card, useLoad } from "../../shared/ui/parts"
import { Switch, TabPanel, Tabs } from "../../shared/ui/rich"
import type { SettingsPort } from "../application/settings-port"
import { type CheckoutRules, type Conversations, type Profile, type Shipping, type StoreSettings, profileError, shippingError } from "../domain/settings"
import { departments } from "../../shared/domain/colombia"
import { MailPanel } from "./mail-panel"
import { PaymentsPanel } from "./payments-panel"
import { TrackingSettingsCard } from "../../fulfillment/ui/tracking"
import { CarriersCard } from "../../fulfillment/ui/carriers-card"

type Tab = "profile" | "payments" | "shipping" | "mail" | "talk" | "page"
const useSettings = () => usePort<SettingsPort>("settings")
const message = (e: unknown) => (e instanceof Error ? e.message : "No se pudo guardar")

const numberOrNull = (text: string) => (text.trim() === "" ? null : Number(text))

/** Who the store is: what shoppers read in every page, email and payment. Saving it changes them all at once. */
function ProfileCard({ initial }: { initial: Profile }) {
  const api = useSettings()
  const { csrf, notify } = useSession()
  const [form, setForm] = useState({ ...initial, hours: initial.hours.join("\n") })
  const [busy, setBusy] = useState(false), [error, setError] = useState("")
  const set = (key: keyof typeof form, value: string) => setForm(f => ({ ...f, [key]: value }))
  async function save(e: FormEvent) {
    e.preventDefault(); setError("")
    const value: Profile = { ...form, hours: form.hours.split("\n").map(h => h.trim()).filter(Boolean) }
    const problem = profileError(value)
    if (problem) { setError(problem); return }
    setBusy(true)
    try { const saved = await api.saveStore(value, csrf); setForm({ ...saved, hours: saved.hours.join("\n") }); notify("Perfil guardado. La tienda y los correos ya lo usan.") }
    catch (err) { setError(message(err)) } finally { setBusy(false) }
  }
  type Field = Exclude<keyof typeof form, "hours">
  const text = (key: Field, label: string, hint?: string, extra?: { placeholder?: string; type?: string; required?: boolean; maxLength?: number; autoComplete?: string }) =>
    <label className="glass-label">{label}<input className="glass-field" type={extra?.type ?? "text"} value={form[key]} onChange={e => set(key, e.target.value)} placeholder={extra?.placeholder} required={extra?.required} maxLength={extra?.maxLength} autoComplete={extra?.autoComplete ?? "off"} />
      {hint && <span className="text-xs text-stone-500">{hint}</span>}</label>
  return <Card icon={Storefront} title="Perfil de la tienda" subtitle="Lo que leen tus clientes en la tienda, los correos y la pasarela de pago">
    <form onSubmit={save} className="mt-4 grid gap-4">
      {error && <p role="alert" className="glass-alert">{error}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        {text("name", "Nombre de la tienda", "Encabeza los correos y los títulos de las páginas.", { required: true, maxLength: 60 })}
        {text("shortName", "Nombre corto", "Para las frases: «Pregúntale a…», «te escribimos de…». Vacío usa el nombre.", { maxLength: 30 })}
        {text("legalName", "Razón social", undefined, { maxLength: 100 })}
        {text("taxId", "NIT", undefined, { maxLength: 30 })}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {text("address", "Dirección de la tienda", "Donde recogen los pedidos.", { maxLength: 120 })}
        {text("addressDetail", "Detalle", "Local, piso o bodega.", { maxLength: 120 })}
        {text("localCity", "Ciudad", "Quien compra en esta ciudad o en su departamento paga la tarifa local.", { maxLength: 60 })}
        <label className="glass-label">Departamento<select className="glass-field" value={form.localState} onChange={e => set("localState", e.target.value)}>
          <option value="">Sin tarifa local</option>
          {departments.map(d => <option key={d.code} value={d.code}>{d.name}</option>)}
        </select></label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {text("whatsapp", "WhatsApp de ventas", "Con el indicativo del país, solo números.", { placeholder: "573001234567", type: "tel", autoComplete: "tel" })}
        {text("phone", "Teléfono fijo", undefined, { type: "tel", maxLength: 30 })}
        {text("email", "Correo de contacto", undefined, { type: "email", placeholder: "ventas@tutienda.com" })}
        <label className="glass-label">Color de la marca<span className="flex items-center gap-2"><input type="color" aria-label="Elegir color" className="h-12 w-12 rounded-xl" value={form.color} onChange={e => set("color", e.target.value)} />
          <input className="glass-field" value={form.color} onChange={e => set("color", e.target.value)} maxLength={7} aria-label="Color en formato #rrggbb" /></span>
          <span className="text-xs text-stone-500">Para el nombre y los botones de los correos.</span></label>
      </div>
      <label className="glass-label">Horario<textarea className="glass-field" rows={3} value={form.hours} onChange={e => set("hours", e.target.value)} placeholder="Lunes a viernes de 9:00 a. m. a 6:00 p. m." />
        <span className="text-xs text-stone-500">Una línea por horario.</span></label>
      <div className="grid gap-4 sm:grid-cols-3">
        {text("site", "Sitio web", undefined, { type: "url", placeholder: "https://" })}
        {text("termsUrl", "Términos y condiciones", "El enlace que acepta el cliente al comprar.", { type: "url", placeholder: "https://" })}
        {text("privacyUrl", "Política de datos", "La exige la Ley 1581.", { type: "url", placeholder: "https://" })}
      </div>
      <div><button className="glass-cta" disabled={busy}>{busy ? "Guardando…" : "Guardar"}</button></div>
    </form>
  </Card>
}

function ShippingCard({ initial, rules, profile }: { initial: Shipping; rules: CheckoutRules; profile: Profile }) {
  const api = useSettings()
  const { csrf, notify } = useSession()
  const [form, setForm] = useState({ localRate: String(initial.localRate), nationalRate: String(initial.nationalRate), freeFromLocal: initial.freeFromLocal == null ? "" : String(initial.freeFromLocal), minimumOrder: String(initial.minimumOrder), pickup: initial.pickup, unpaidHours: String(rules.unpaidHours), shopperCancels: rules.shopperCancels ?? true })
  const [busy, setBusy] = useState(false), [error, setError] = useState("")
  async function save(e: FormEvent) {
    e.preventDefault(); setError("")
    const value: Shipping = { localRate: Number(form.localRate), nationalRate: Number(form.nationalRate), freeFromLocal: numberOrNull(form.freeFromLocal), minimumOrder: Number(form.minimumOrder || 0), pickup: form.pickup }
    const problem = shippingError(value) ?? (Number(form.unpaidHours) >= 1 && Number(form.unpaidHours) <= 720 ? null : "El plazo para pagar va de 1 a 720 horas")
    if (problem) { setError(problem); return }
    setBusy(true)
    try { await api.saveShipping(value, csrf); await api.saveCheckout({ unpaidHours: Math.round(Number(form.unpaidHours)), shopperCancels: form.shopperCancels }, csrf); notify("Envíos y plazos guardados.") }
    catch (err) { setError(message(err)) } finally { setBusy(false) }
  }
  const city = profile.localCity || "tu ciudad"
  const money = (key: "localRate" | "nationalRate" | "freeFromLocal" | "minimumOrder", label: string, hint: string, required = true) => <label className="glass-label">{label}
    <span className="glass-money"><span aria-hidden="true">$</span><input className="glass-field" type="number" min="0" step="1" inputMode="numeric" required={required} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} /></span>
    <span className="text-xs text-stone-500">{hint}</span></label>
  return <Card icon={Truck} title="Envíos y plazos" subtitle="Valores en pesos con IVA incluido; es lo que paga el cliente">
    <form onSubmit={save} className="mt-4 grid gap-4">
      {error && <p role="alert" className="glass-alert">{error}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        {money("localRate", `Envío en ${city}`, profile.localCity ? "Tarifa única dentro de la ciudad y su departamento." : "Escribe la ciudad de la tienda en la pestaña Perfil para usar esta tarifa.")}
        {money("nationalRate", "Envío al resto del país", "Tarifa única para las demás ciudades.")}
        {money("freeFromLocal", `Envío gratis en ${city} desde`, "Déjalo vacío para cobrar siempre el envío.", false)}
        {money("minimumOrder", "Compra mínima", "Por debajo de este valor no se puede finalizar la compra.", false)}
      </div>
      <Switch title="Permitir recoger en la tienda" hint={profile.address ? `El cliente no paga envío y recoge en ${profile.address}.` : "El cliente no paga envío. Escribe la dirección en la pestaña Perfil."} checked={form.pickup} onChange={v => setForm({ ...form, pickup: v })} />
      <Switch title="El cliente puede cancelar antes del envío" hint={form.shopperCancels
        ? "Mientras el pedido no haya salido, el cliente lo cancela desde su cuenta y se le devuelve el dinero solo: por la pasarela o por transferencia a la cuenta que escriba. Cuando sale, ya no se cancela desde la tienda."
        : "Solo la tienda cancela pedidos, desde el panel. El cliente ve que debe escribir por WhatsApp."} checked={form.shopperCancels} onChange={v => setForm({ ...form, shopperCancels: v })} />
      <label className="glass-label">Horas para pagar un pedido<input className="glass-field" type="number" min="1" max="720" step="1" required value={form.unpaidHours} onChange={e => setForm({ ...form, unpaidHours: e.target.value })} />
        <span className="text-xs text-stone-500">Pasado ese tiempo el pedido sin pagar se cancela solo y sus unidades vuelven al inventario.</span></label>
      <div><button className="glass-cta" disabled={busy}>{busy ? "Guardando…" : "Guardar"}</button></div>
    </form>
  </Card>
}

function TalkCard({ initial, shortName }: { initial: Conversations; shortName: string }) {
  const api = useSettings()
  const { csrf, notify } = useSession()
  const [value, setValue] = useState(initial), [busy, setBusy] = useState(false), [error, setError] = useState("")
  const set = (patch: Partial<Conversations>) => setValue(v => ({ ...v, ...patch }))
  async function save() {
    setBusy(true); setError("")
    try { setValue(await api.saveConversations(value, csrf)); notify("Conversaciones guardadas.") } catch (err) { setError(message(err)) } finally { setBusy(false) }
  }
  return <Card icon={ChatsCircle} title="Opiniones y preguntas" subtitle="Para escribir, el cliente debe iniciar sesión. Aquí decides qué se permite en toda la tienda">
    <div className="mt-4 grid gap-2">
      {error && <p role="alert" className="glass-alert">{error}</p>}
      <Switch title="Opiniones con estrellas" hint="Los clientes califican los productos de 1 a 5." checked={value.reviews} onChange={v => set({ reviews: v })} />
      <Switch title="Preguntas de clientes" hint={`Los clientes preguntan y ${shortName} responde en la página del producto.`} checked={value.questions} onChange={v => set({ questions: v })} />
      <Switch title="Revisar antes de publicar" hint="Cada opinión o pregunta espera tu aprobación en la sección Opiniones." checked={value.manualModeration} onChange={v => set({ manualModeration: v })} />
      <Switch title="Solo opinan quienes compraron" hint="Exige una compra pagada del producto con cuenta de Google o Facebook. Las preguntas siguen abiertas." checked={value.buyersOnly} onChange={v => set({ buyersOnly: v })} />
      <Switch title="Los clientes pueden responder" hint={`Además de ${shortName}, otros clientes pueden contestar opiniones y preguntas.`} checked={value.customerReplies} onChange={v => set({ customerReplies: v })} />
      <div className="mt-2"><button type="button" className="glass-cta" disabled={busy} onClick={() => void save()}>{busy ? "Guardando…" : "Guardar"}</button></div>
    </div>
  </Card>
}

function PageCard({ initial }: { initial: Record<string, string> }) {
  const api = useSettings()
  const { csrf, notify } = useSession()
  const [hidden, setHidden] = useState(() => new Set(Object.entries(initial).filter(([, v]) => v === "hide").map(([k]) => k)))
  const [busy, setBusy] = useState(false), [error, setError] = useState("")
  async function save() {
    setBusy(true); setError("")
    try { await api.saveProductPage(Object.fromEntries(Array.from(hidden).map(key => [key, "hide"])), csrf); notify("Página de producto guardada.") } catch (err) { setError(message(err)) } finally { setBusy(false) }
  }
  return <Card icon={Layout} title="Página de producto" subtitle="Lo que muestran todos los productos. Cada producto puede decidir distinto en su pestaña Página">
    <div className="mt-4 grid gap-2">
      {error && <p role="alert" className="glass-alert">{error}</p>}
      {SECTIONS.map(section => <Switch key={section.key} title={section.title} hint={section.hint} checked={!hidden.has(section.key)} onChange={on => setHidden(current => { const next = new Set(current); if (on) next.delete(section.key); else next.add(section.key); return next })} />)}
      <div className="mt-2"><button type="button" className="glass-cta" disabled={busy} onClick={() => void save()}>{busy ? "Guardando…" : "Guardar"}</button></div>
    </div>
  </Card>
}

/** Panel section "Tienda": who the store is, how it takes payments, delivery, email, conversations and the product page. */
export function StoreSection() {
  const api = useSettings()
  const state = useLoad(() => api.load(), [])
  const [tab, setTab] = useState<Tab>("profile")
  return <div className="glass-scroll">
    <Tabs label="Ajustes de la tienda" value={tab} onChange={setTab} tabs={[{ id: "profile", label: "Perfil" }, { id: "payments", label: "Pagos" }, { id: "shipping", label: "Envíos" }, { id: "mail", label: "Correo" }, { id: "talk", label: "Conversaciones" }, { id: "page", label: "Página de producto" }]} />
    <Async state={state} label="Cargando ajustes" rows={4}>{(data: StoreSettings) => <>
      <TabPanel active={tab === "profile"}><ProfileCard initial={data.store} /></TabPanel>
      <TabPanel active={tab === "payments"}><PaymentsPanel initial={data.payments} /></TabPanel>
      <TabPanel active={tab === "mail"}><MailPanel /></TabPanel>
      <TabPanel active={tab === "shipping"}><div className="grid gap-4"><ShippingCard initial={data.shipping} rules={data.checkout} profile={data.store} /><CarriersCard /><TrackingSettingsCard /></div></TabPanel>
      <TabPanel active={tab === "talk"}><TalkCard initial={data.conversations} shortName={data.store.shortName} /></TabPanel>
      <TabPanel active={tab === "page"}><PageCard initial={data.productPage} /></TabPanel>
    </>}</Async>
  </div>
}

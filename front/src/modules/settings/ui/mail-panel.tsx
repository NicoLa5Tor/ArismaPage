"use client"

import { useState, type FormEvent } from "react"
import { EnvelopeSimple, PaperPlaneTilt, Tray } from "@phosphor-icons/react"
import { usePort } from "../../shared/ui/ports"
import { useSession } from "../../shared/ui/admin-context"
import { Async, Badge, Card, Pager, type Tone, useLoad } from "../../shared/ui/parts"
import type { SettingsPort } from "../application/settings-port"
import { type Mail, type MailSecurity, type OutboxItem, mailPresets } from "../domain/settings"

const message = (e: unknown) => (e instanceof Error ? e.message : "No se pudo completar")
const STATUS: Record<OutboxItem["status"], { label: string; tone: Tone }> = { stored: { label: "Guardado sin enviar", tone: "neutral" }, pending: { label: "Por enviar", tone: "warn" }, sent: { label: "Enviado", tone: "good" }, failed: { label: "Falló", tone: "bad" } }
const dates = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota" })
const PAGE = 20

/** The mail server the store sends with, a test email, and the outbox with everything the store wrote. */
export function MailPanel() {
  const api = usePort<SettingsPort>("settings")
  const view = useLoad(() => api.loadMail(), [])
  return <Async state={view} label="Cargando el correo" rows={3}>{(data) => <div className="grid gap-4"><MailForm initial={data.settings} passwordStored={data.passwordStored} onSaved={view.reload} /><OutboxCard /></div>}</Async>
}

function MailForm({ initial, passwordStored, onSaved }: { initial: Mail; passwordStored: boolean; onSaved: () => void }) {
  const api = usePort<SettingsPort>("settings")
  const { csrf, notify, user } = useSession()
  const [form, setForm] = useState({ ...initial, port: String(initial.port) })
  const [password, setPassword] = useState(""), [testTo, setTestTo] = useState(user.email)
  const [busy, setBusy] = useState(false), [testing, setTesting] = useState(false), [error, setError] = useState(""), [result, setResult] = useState("")
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }))

  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("")
    try { await api.saveMail({ ...form, port: Number(form.port) || 587 }, password, csrf); setPassword(""); notify(form.host ? "Correo guardado. Prueba el envío abajo." : "Correo guardado. Sin servidor, los correos quedan en la bandeja."); onSaved() }
    catch (e) { setError(message(e)) } finally { setBusy(false) }
  }
  async function test() {
    setTesting(true); setError(""); setResult("")
    try { setResult(await api.sendTestMail(testTo.trim(), csrf)) } catch (e) { setError(message(e)) } finally { setTesting(false) }
  }
  return (
    <Card icon={EnvelopeSimple} title="Servidor de correo" subtitle="Sirve cualquier servicio SMTP. Sin servidor, cada correo queda en la bandeja de abajo y no se envía."
      actions={<Badge tone={initial.host ? "good" : "warn"}>{initial.host ? "Enviando" : "Sin servidor"}</Badge>}>
      <form onSubmit={save} className="mt-4 grid gap-4">
        {error && <p role="alert" className="glass-alert">{error}</p>}
        <div className="flex flex-wrap gap-2" role="group" aria-label="Valores sugeridos">{mailPresets.map((p) => <button key={p.name} type="button" className="glass-preset" title={p.hint} onClick={() => setForm((f) => ({ ...f, host: p.host, port: String(p.port), security: p.security }))}>{p.name}</button>)}</div>
        <div className="grid gap-4 sm:grid-cols-[2fr_1fr_1fr]">
          <label className="glass-label">Servidor (host)<input className="glass-field" value={form.host} spellCheck={false} onChange={(e) => set("host", e.target.value)} placeholder="smtp-relay.brevo.com" /></label>
          <label className="glass-label">Puerto<input className="glass-field" type="number" min="1" max="65535" value={form.port} onChange={(e) => set("port", e.target.value)} /></label>
          <label className="glass-label">Seguridad<select className="glass-field" value={form.security} onChange={(e) => set("security", e.target.value as MailSecurity)}><option value="STARTTLS">STARTTLS</option><option value="SSL">SSL</option><option value="NONE">Ninguna</option></select></label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="glass-label">Usuario<input className="glass-field" value={form.username} autoComplete="off" spellCheck={false} onChange={(e) => set("username", e.target.value)} /></label>
          <label className="glass-label">Contraseña<input className="glass-field" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={passwordStored ? "Guardada · escribe para cambiarla" : "Sin guardar"} /><span className="text-xs text-stone-500">Se guarda cifrada.</span></label>
          <label className="glass-label">Correo remitente<input className="glass-field" type="email" value={form.fromAddress} onChange={(e) => set("fromAddress", e.target.value)} placeholder="pedidos@tutienda.com" /></label>
          <label className="glass-label">Nombre del remitente<input className="glass-field" value={form.fromName} maxLength={60} onChange={(e) => set("fromName", e.target.value)} /></label>
          <label className="glass-label sm:col-span-2">Avisos de pedidos nuevos a<input className="glass-field" type="email" value={form.storeInbox} onChange={(e) => set("storeInbox", e.target.value)} placeholder="ventas@tutienda.com" /><span className="text-xs text-stone-500">Opcional. Recibe un correo por cada pedido de la tienda.</span></label>
        </div>
        <div><button className="glass-cta" disabled={busy}>{busy ? "Guardando…" : "Guardar"}</button></div>
      </form>
      {initial.host && <div className="glass-subpanel mt-4 grid gap-2">
        <label className="glass-label">Enviar un correo de prueba a<span className="flex gap-2"><input className="glass-field" type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} /><button type="button" className="glass-chip" disabled={testing || !testTo.trim()} onClick={() => void test()}><PaperPlaneTilt size={16} aria-hidden="true" /> {testing ? "Enviando…" : "Enviar"}</button></span></label>
        {result && <p role="status" className="text-sm text-emerald-300">{result}</p>}
      </div>}
    </Card>
  )
}

function OutboxCard() {
  const api = usePort<SettingsPort>("settings")
  const [offset, setOffset] = useState(0), [open, setOpen] = useState<string | null>(null)
  const state = useLoad(() => api.outbox(PAGE, offset), [offset])
  return (
    <Card icon={Tray} title="Bandeja de correos" subtitle="Todo lo que la tienda escribió: confirmaciones, avisos, enlaces de cuenta. Si no hay servidor, ábrelos desde aquí.">
      <div className="mt-4"><Async state={state} label="Cargando la bandeja" rows={4} empty={{ icon: Tray, title: "Aún no hay correos", hint: "Aparecerán cuando alguien compre o pida un enlace de su cuenta.", when: (d) => d.items.length === 0 }}>{(data) => <div className="grid gap-2">
        {data.items.map((item) => <article key={item.id} className="glass-subpanel grid gap-2">
          <header className="flex flex-wrap items-center gap-2 text-sm"><Badge tone={STATUS[item.status].tone}>{STATUS[item.status].label}</Badge><strong className="min-w-0 flex-1 truncate">{item.subject}</strong><span className="text-xs text-stone-500">{dates.format(new Date(item.createdAt))}</span></header>
          <p className="text-xs text-stone-500">Para {item.recipient}{item.lastError ? ` · ${item.lastError}` : ""}</p>
          <button type="button" className="glass-chip w-fit" aria-expanded={open === item.id} onClick={() => setOpen(open === item.id ? null : item.id)}>{open === item.id ? "Ocultar" : "Ver el correo"}</button>
          {open === item.id && <iframe title={`Correo: ${item.subject}`} className="mail-preview" sandbox="allow-popups allow-popups-to-escape-sandbox" srcDoc={item.bodyHtml.replace("<head>", "<head><base target=\"_blank\">").replace("<body", "<base target=\"_blank\"><body")} />}
        </article>)}
        <Pager offset={offset} total={data.total} size={PAGE} onChange={setOffset} />
      </div>}</Async></div>
    </Card>
  )
}

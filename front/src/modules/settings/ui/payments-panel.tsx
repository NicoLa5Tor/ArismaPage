"use client"

import { useState, type FormEvent } from "react"
import { CheckCircle, CreditCard, Flask, Storefront, WarningCircle } from "@phosphor-icons/react"
import { usePort } from "../../shared/ui/ports"
import { useSession } from "../../shared/ui/admin-context"
import { Badge, Card } from "../../shared/ui/parts"
import { Segmented } from "../../shared/ui/rich"
import type { SettingsPort } from "../application/settings-port"
import { type Environment, type Gateway, type GatewayCode, type Payments, credentialsOf, fieldText, gatewayNotes } from "../domain/settings"

const message = (e: unknown) => (e instanceof Error ? e.message : "No se pudo guardar")
const modeOptions: { value: Environment; label: string }[] = [{ value: "test", label: "Pruebas" }, { value: "live", label: "Producción" }]

/**
 * Payments: which single method the store takes, whether it charges for real, and each method's credentials for
 * tests and for production. The store refuses to activate a method whose credentials for that mode are incomplete.
 */
export function PaymentsPanel({ initial }: { initial: Payments }) {
  const api = usePort<SettingsPort>("settings")
  const { csrf, notify } = useSession()
  const [payments, setPayments] = useState(initial)
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [confirmLive, setConfirmLive] = useState(false)

  async function choose(active: GatewayCode | "", mode: Environment, confirmed = false) {
    // going live charges real money: it takes a second, explicit click
    if (mode === "live" && payments.mode === "test" && !confirmed) { setConfirmLive(true); return }
    setConfirmLive(false)
    setBusy(true); setError("")
    try {
      const saved = await api.choosePayments(active, mode, csrf)
      setPayments(saved)
      notify(saved.active ? `La tienda cobra con ${saved.gateways.find((g) => g.code === saved.active)?.label} en ${saved.mode === "test" ? "modo de pruebas" : "producción"}.` : "La tienda no recibe pagos por la página.")
    } catch (e) { setError(message(e)) } finally { setBusy(false) }
  }
  const active = payments.gateways.find((g) => g.code === payments.active)
  return (
    <div className="grid gap-4">
      <Card icon={Storefront} title="Cómo cobra la tienda" subtitle="Elige un solo medio de pago. Los clientes pagan siempre con ese."
        actions={<Badge tone={payments.ready ? (payments.mode === "test" && active?.environments ? "warn" : "good") : "bad"}>{payments.ready ? (payments.mode === "test" && active?.environments ? "Cobrando en pruebas" : "Cobrando") : "Sin cobrar"}</Badge>}>
        <div className="mt-4 grid gap-4">
          {error && <p role="alert" className="glass-alert">{error}</p>}
          <div className="grid gap-2"><span className="text-sm font-semibold">Modo</span>
            <Segmented label="Modo de pagos" value={payments.mode} options={modeOptions} onChange={(mode) => { if (!busy) void choose(payments.active, mode) }} />
            {confirmLive && <div className="glass-dialog-confirm" role="alertdialog" aria-label="Confirmar producción"><span>En producción la tienda cobra de verdad con las credenciales de producción.</span>
              <span className="flex gap-2"><button type="button" className="glass-chip" onClick={() => setConfirmLive(false)}>Seguir en pruebas</button><button type="button" className="glass-cta" disabled={busy} onClick={() => void choose(payments.active, "live", true)}>Pasar a producción</button></span></div>}
            <span className="text-xs text-stone-500">{payments.mode === "test" ? "Pruebas: usa las credenciales de pruebas y la página de pagos de prueba. Nada se cobra de verdad y esos pedidos no cuentan como ventas." : "Producción: usa las credenciales de producción y cobra de verdad."}</span>
          </div>
          <fieldset className="grid gap-2"><legend className="mb-2 text-sm font-semibold">Medio de pago activo</legend>
            {payments.gateways.map((g) => {
              const ready = credentialsOf(g, payments.mode).complete
              return (
                <label key={g.code} className="glass-option" data-checked={payments.active === g.code || undefined}>
                  <input type="radio" name="medio-activo" checked={payments.active === g.code} disabled={busy} onChange={() => void choose(g.code, payments.mode)} />
                  <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{g.label}</span>
                    <span className="block text-xs text-stone-500">{ready ? (g.environments ? `Credenciales de ${payments.mode === "test" ? "pruebas" : "producción"} completas` : "Instrucciones listas") : `Faltan datos${g.environments ? ` de ${payments.mode === "test" ? "pruebas" : "producción"}` : ""}: complétalos abajo antes de activarlo`}</span></span>
                  {ready ? <CheckCircle size={18} weight="fill" className="text-emerald-400" aria-hidden="true" /> : <WarningCircle size={18} weight="fill" className="text-amber-400" aria-hidden="true" />}
                </label>
              )
            })}
            <label className="glass-option" data-checked={payments.active === "" || undefined}>
              <input type="radio" name="medio-activo" checked={payments.active === ""} disabled={busy} onChange={() => void choose("", payments.mode)} />
              <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">Ninguno</span><span className="block text-xs text-stone-500">El checkout invita a terminar la compra por WhatsApp.</span></span>
            </label>
          </fieldset>
        </div>
      </Card>
      <div className="grid gap-4 xl:grid-cols-2">
        {payments.gateways.map((g) => <CredentialsCard key={g.code} gateway={g} mode={payments.mode} active={payments.active === g.code} onSaved={setPayments} />)}
      </div>
    </div>
  )
}

function CredentialsCard({ gateway, mode, active, onSaved }: { gateway: Gateway; mode: Environment; active: boolean; onSaved: (p: Payments) => void }) {
  const [environment, setEnvironment] = useState<Environment>(gateway.environments ? mode : "live")
  return (
    <Card icon={gateway.environments ? CreditCard : Storefront} title={gateway.label} subtitle={gatewayNotes[gateway.code]} actions={active ? <Badge tone="good">Activo</Badge> : undefined}>
      <div className="mt-4 grid gap-4">
        {gateway.environments && <Segmented label={`Credenciales de ${gateway.label}`} value={environment} options={[{ value: "test", label: "Pruebas", icon: Flask }, { value: "live", label: "Producción", icon: CreditCard }]} onChange={setEnvironment} />}
        <CredentialsForm key={`${gateway.code}-${environment}`} gateway={gateway} environment={environment} onSaved={onSaved} />
      </div>
    </Card>
  )
}

function CredentialsForm({ gateway, environment, onSaved }: { gateway: Gateway; environment: Environment; onSaved: (p: Payments) => void }) {
  const api = usePort<SettingsPort>("settings")
  const { csrf, notify } = useSession()
  const stored = credentialsOf(gateway, environment)
  const [config, setConfig] = useState(stored.config), [secrets, setSecrets] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false), [error, setError] = useState("")
  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("")
    try { onSaved(await api.saveCredentials(gateway.code, environment, { config, secrets }, csrf)); setSecrets({}); notify(`${gateway.label}: datos de ${gateway.environments ? (environment === "test" ? "pruebas" : "producción") : "pago"} guardados.`) }
    catch (e) { setError(message(e)) } finally { setBusy(false) }
  }
  return (
    <form onSubmit={save} className="grid gap-4">
      {error && <p role="alert" className="glass-alert">{error}</p>}
      <p className="flex items-center gap-2 text-xs text-stone-500">{stored.complete ? <><CheckCircle size={14} weight="fill" className="text-emerald-400" aria-hidden="true" /> Completo</> : <><WarningCircle size={14} weight="fill" className="text-amber-400" aria-hidden="true" /> Incompleto</>}</p>
      {gateway.publicFields.map((field) => <label key={field} className="glass-label">{fieldText[field]?.label ?? field}
        {field === "instructions" ? <textarea className="glass-field" rows={4} maxLength={2000} value={config[field] ?? ""} onChange={(e) => setConfig({ ...config, [field]: e.target.value })} placeholder="Banco, tipo y número de cuenta, titular, NIT. Envía el comprobante a nuestro WhatsApp." />
          : <input className="glass-field" autoComplete="off" spellCheck={false} value={config[field] ?? ""} onChange={(e) => setConfig({ ...config, [field]: e.target.value })} />}
        <span className="text-xs text-stone-500">{fieldText[field]?.hint}</span></label>)}
      {gateway.secretFields.map((field) => <label key={field} className="glass-label">{fieldText[field]?.label ?? field}
        <input className="glass-field" type="password" autoComplete="new-password" spellCheck={false} value={secrets[field] ?? ""} onChange={(e) => setSecrets({ ...secrets, [field]: e.target.value })} placeholder={stored.secrets[field] ? `Guardada ${stored.secrets[field]} · escribe para cambiarla` : "Sin guardar"} />
        <span className="text-xs text-stone-500">{fieldText[field]?.hint} Se guarda cifrada y no se vuelve a mostrar.</span></label>)}
      <div><button className="glass-cta" disabled={busy}>{busy ? "Guardando…" : "Guardar"}</button></div>
    </form>
  )
}

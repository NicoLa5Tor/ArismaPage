"use client"

import { useState, type FormEvent } from "react"
import { ArrowSquareOut, ArrowsClockwise, Check, Copy, MapTrifold } from "@phosphor-icons/react"
import { trackingStages } from "../../shared/domain/carriers"
import type { Shipment, TrackingStatus } from "../domain/fulfillment"
import { dateTime } from "../../shared/ui/format"
import { Async, Card, useLoad } from "../../shared/ui/parts"
import { Switch } from "../../shared/ui/rich"
import { useCan, useSession } from "../../shared/ui/admin-context"
import { useFulfillmentPort } from "./use-fulfillment"

const message = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback)

/**
 * What the carrier says about a shipment on its way: the stage, its movements and a link to the carrier's page.
 * "Actualizar" asks the carrier now (and starts following the guide if the round had not reached it yet).
 */
export function TrackingBlock({ orderId, shipment, onChange }: { orderId: string; shipment: Shipment; onChange: (s: Shipment) => void }) {
  const api = useFulfillmentPort()
  const { csrf } = useSession()
  const canManage = useCan()("FULFILLMENT_MANAGE")
  const [busy, setBusy] = useState(false), [error, setError] = useState("")
  if (shipment.method !== "carrier" || !shipment.trackingCode) return null
  // the link the shopper gets: straight to the guide when the carrier's page takes the number
  const carrierName = shipment.carrier ?? "la transportadora"
  const tracking = shipment.tracking
  const stage = tracking?.stage ? trackingStages[tracking.stage] : null
  const live = shipment.status === "shipped" || shipment.status === "failed"
  async function refresh() {
    setBusy(true); setError("")
    try { onChange(await api.refreshTracking(orderId, csrf)) } catch (e) { setError(message(e, "No se pudo consultar la transportadora")) } finally { setBusy(false) }
  }
  return <section className="mt-4 grid gap-2" aria-labelledby={`tracking-${orderId}`}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 id={`tracking-${orderId}`} className="text-sm font-semibold">Seguimiento de la transportadora</h3>
      {stage && <span className="glass-badge" data-tone={stage.tone}>{stage.label}</span>}
    </div>
    {tracking?.state === "rejected" && <p className="glass-alert" role="alert">{tracking.error} Corrige la guía o la transportadora para volver a intentarlo.</p>}
    {!tracking && live && <p className="text-xs text-stone-500">Aún no se sigue esta guía. Si el seguimiento automático está activo, empieza en la próxima ronda (cada media hora), o pulsa Actualizar.</p>}
    {tracking?.checkedAt && <p className="text-xs text-stone-500">Consultado {dateTime(tracking.checkedAt)}</p>}
    {tracking && tracking.events.length > 0 && <ol className="glass-timeline">
      {tracking.events.map((e, i) => <li key={`${e.at}-${i}`} data-kind={i === 0 ? "delivery" : undefined}><time dateTime={e.at}>{dateTime(e.at)}{e.location ? ` · ${e.location}` : ""}</time>{e.description}</li>)}
    </ol>}
    {tracking && tracking.state !== "rejected" && tracking.events.length === 0 && <p className="text-xs text-stone-500">La transportadora todavía no publica movimientos.</p>}
    {error && <p role="alert" className="glass-field-error">{error}</p>}
    <div className="flex flex-wrap gap-2">
      {canManage && live && <button type="button" className="glass-chip" disabled={busy} onClick={() => void refresh()}><ArrowsClockwise size={14} aria-hidden="true" className={busy ? "spin" : undefined} /> {busy ? "Consultando…" : "Actualizar"}</button>}
      {shipment.trackingUrl && <a className="glass-chip" href={shipment.trackingUrl} target="_blank" rel="noopener noreferrer"><ArrowSquareOut size={14} aria-hidden="true" /> {shipment.opensGuide ? `Ver la guía en ${carrierName}` : `Abrir ${carrierName}`}</a>}
      {shipment.follow === false && <span className="text-xs text-stone-500">Solo enlace: esta guía no se sigue automáticamente.</span>}
    </div>
  </section>
}

/** Ajustes, Envíos: the administrator decides whether the store follows guides by itself, and sees the month's use. */
/** The webhook address to paste in 17TRACK, so each change of a guide arrives at once instead of every few hours. */
function WebhookAddress({ url, reachable }: { url: string; reachable: boolean }) {
  const [copied, setCopied] = useState(false), [failed, setFailed] = useState(false)
  async function copy() {
    setFailed(false)
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000) }
    catch { setFailed(true) }
  }
  return <div className="grid gap-2">
    <label className="glass-label">Dirección del webhook
      <span className="flex flex-wrap items-center gap-2">
        <input className="glass-field min-w-0 flex-1" readOnly value={url} onFocus={e => e.currentTarget.select()} spellCheck={false} />
        <button type="button" className="glass-chip" onClick={() => void copy()}>{copied ? <><Check aria-hidden /> Copiada</> : <><Copy aria-hidden /> Copiar</>}</button>
      </span>
    </label>
    {failed && <p className="glass-field-error" role="alert">No se pudo copiar. Selecciona la dirección y cópiala a mano.</p>}
    <p className="text-xs text-stone-500">En api.17track.net, en Configuración → Webhook, pega esta dirección en «URL», elige la versión <strong>V 2.2</strong>, deja marcados los estados y guarda. Así cada cambio de una guía llega al momento, sin esperar la consulta de cada pocas horas.</p>
    {!reachable && <p className="glass-alert" role="status">Esta dirección es de este computador o no usa https, así que 17TRACK no puede llegar a ella. Funciona cuando la tienda esté publicada con su dominio; mientras tanto, las guías se siguen consultando cada pocas horas.</p>}
  </div>
}

export function TrackingSettingsCard() {
  const api = useFulfillmentPort()
  const state = useLoad(() => api.trackingStatus(), [])
  return <Card icon={MapTrifold} title="Seguimiento automático de envíos" subtitle="La tienda consulta a la transportadora y muestra cada paso al cliente en su pedido">
    <Async state={state} label="Cargando seguimiento" rows={2}>{(data: TrackingStatus) => <TrackingSettingsForm initial={data} />}</Async>
  </Card>
}

function TrackingSettingsForm({ initial }: { initial: TrackingStatus }) {
  const api = useFulfillmentPort()
  const { csrf, notify } = useSession()
  const [status, setStatus] = useState(initial), [busy, setBusy] = useState(false), [error, setError] = useState("")
  async function toggle(on: boolean) {
    setBusy(true); setError("")
    try { setStatus(await api.setTracking(on, csrf)); notify(on ? "Seguimiento automático activado." : "Seguimiento automático apagado.") }
    catch (e) { setError(message(e, "No se pudo guardar")) } finally { setBusy(false) }
  }
  const [key, setKey] = useState(""), [keyBusy, setKeyBusy] = useState(false), [keyError, setKeyError] = useState(""), [confirmRemove, setConfirmRemove] = useState(false)
  const canEdit = useCan()("SETTINGS_MANAGE")
  async function saveKey(e: FormEvent) {
    e.preventDefault(); setKeyError("")
    if (!key.trim()) { setKeyError("Pega la Security Key de 17TRACK."); return }
    setKeyBusy(true)
    try { setStatus(await api.saveTrackingKey(key.trim(), csrf)); setKey(""); notify("17TRACK aceptó la llave. Quedó guardada.") }
    catch (err) { setKeyError(message(err, "No se pudo guardar la llave")) } finally { setKeyBusy(false) }
  }
  async function removeKey() {
    setKeyBusy(true); setKeyError("")
    try { setStatus(await api.removeTrackingKey(csrf)); setConfirmRemove(false); notify("Llave de 17TRACK quitada.") }
    catch (err) { setKeyError(message(err, "No se pudo quitar la llave")) } finally { setKeyBusy(false) }
  }
  const account = status.account
  const accountShare = account && account.total > 0 ? Math.min(100, Math.round((account.used / account.total) * 100)) : 0
  const share = status.limit === 0 ? 0 : Math.min(100, Math.round((status.used / status.limit) * 100))
  const month = new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${status.month}-15T00:00:00Z`))
  return <div className="mt-4 grid gap-4">
    {error && <p role="alert" className="glass-alert">{error}</p>}
    <section className="tracking-account" aria-labelledby="tracking-account-title">
      <h3 id="tracking-account-title" className="text-sm font-semibold">Cuenta de 17TRACK</h3>
      {status.keySource === "panel" && <p className="text-sm">La tienda usa su propia llave de 17TRACK.</p>}
      {status.keySource === "servidor" && <p className="text-sm">La tienda usa la llave del servidor. Puedes poner la de tu propia cuenta.</p>}
      {!status.keySource && <p className="text-sm text-stone-400">Sin llave todavía: mientras tanto, el cliente ve la guía y el enlace a la transportadora.</p>}
      {account ? <div className="grid gap-2">
        <div className="tracking-account-numbers">
          <p><strong>{account.remaining.toLocaleString("es-CO")}</strong><span>guías disponibles</span></p>
          <p><strong>{account.used.toLocaleString("es-CO")}</strong><span>usadas de {account.total.toLocaleString("es-CO")}</span></p>
          <p><strong>{account.usedToday.toLocaleString("es-CO")}</strong><span>hoy{account.dailyLimit ? ` (límite ${account.dailyLimit.toLocaleString("es-CO")})` : ""}</span></p>
        </div>
        <div className="glass-meter" aria-label="Cupo de 17TRACK"><div><span>Cupo</span><i role="progressbar" aria-valuemin={0} aria-valuemax={account.total} aria-valuenow={account.used} aria-label={`${account.used} de ${account.total} guías usadas`}><b style={{ width: `${accountShare}%` }} /></i><span>{accountShare} %</span></div></div>
        <p className="text-xs text-stone-500">Dato de 17TRACK al abrir esta página. Cada guía nueva gasta una unidad del cupo; seguirla después no gasta más. Para recargar, entra a api.17track.net.</p>
      </div> : status.accountError ? <p className="glass-alert" role="status">No se pudo consultar la cuenta: {status.accountError}</p> : null}
      {canEdit && <form className="grid gap-2" onSubmit={saveKey} noValidate>
        <label className="glass-label">{status.keySource === "panel" ? "Cambiar la Security Key" : "Security Key de tu cuenta de API"}
          <input className="glass-field" type="password" autoComplete="new-password" name="tracking-security-key" data-1p-ignore data-lpignore="true" spellCheck={false} value={key} onChange={e => setKey(e.target.value)} placeholder="Está en api.17track.net, en la sección de configuración" />
        </label>
        {keyError && <p className="glass-field-error" role="alert">{keyError}</p>}
        <div className="flex flex-wrap items-center gap-2">
          <button className="glass-cta" disabled={keyBusy || !key.trim()}>{keyBusy ? "Comprobando con 17TRACK…" : "Comprobar y guardar"}</button>
          {status.keySource === "panel" && (confirmRemove
            ? <span className="flex flex-wrap items-center gap-2 text-sm">¿Quitar la llave?<button type="button" className="glass-chip glass-chip-danger" disabled={keyBusy} onClick={() => void removeKey()}>Sí, quitarla</button><button type="button" className="glass-chip" onClick={() => setConfirmRemove(false)}>No</button></span>
            : <button type="button" className="glass-chip" disabled={keyBusy} onClick={() => setConfirmRemove(true)}>Quitar llave</button>)}
        </div>
        <p className="text-xs text-stone-500">Antes de guardarla, la tienda le pregunta a 17TRACK si es válida. Queda cifrada y no se vuelve a mostrar.</p>
      </form>}
      <WebhookAddress url={status.webhookUrl} reachable={status.webhookReachable} />
    </section>
    <Switch title="Seguir las guías automáticamente" hint="Al despachar con transportadora, la guía se consulta cada pocas horas. Cuando la transportadora confirma la entrega, el pedido se marca entregado solo." checked={status.enabled} disabled={busy || !status.ready} onChange={v => void toggle(v)} />
    <div className="glass-meter" aria-label="Uso del mes">
      <div><span>Plan {status.planLabel}</span><i role="progressbar" aria-valuemin={0} aria-valuemax={status.limit} aria-valuenow={status.used} aria-label={`${status.used} de ${status.limit} envíos`}><b style={{ width: `${share}%` }} /></i><span>{status.used} de {status.limit}</span></div>
    </div>
    <p className="text-xs text-stone-500">Envíos con seguimiento en {month}: cada guía cuenta una sola vez. Quedan {status.remaining}. Cuando se acaban, los pedidos siguen mostrando la guía y el enlace a la transportadora.</p>
    {status.plan === "free" && <p className="text-sm">El plan Gratis incluye 10 envíos al mes. El plan Plus, de 5 USD al mes, sube a 50. Para activarlo, escríbele a quien administra tu tienda.</p>}
  </div>
}

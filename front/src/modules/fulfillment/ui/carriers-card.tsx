"use client"

import { useState, type FormEvent } from "react"
import { ArrowSquareOut, PencilSimple, Plus, Truck } from "@phosphor-icons/react"
import { NUMBER_SLOT, linkFor, type CarrierInfo } from "../../shared/domain/carriers"
import { Async, Badge, Card, useLoad } from "../../shared/ui/parts"
import { Switch } from "../../shared/ui/rich"
import { useCan, useSession } from "../../shared/ui/admin-context"
import { useFulfillmentPort } from "./use-fulfillment"

const blank: CarrierInfo = { code: "", name: "", aliases: [], trackingKey: null, linkTemplate: null, pageUrl: null, numberHint: "", active: true, position: 99 }
const SAMPLE = "123456789"

/**
 * The carriers the team picks from when sending with a guide (Tienda → Envíos). Each one has the link the shopper
 * gets: with {guia} where its page takes the number, or just its tracking page. «Probar» opens it with a sample guide.
 */
export function CarriersCard() {
  const api = useFulfillmentPort()
  const [version, setVersion] = useState(0)
  const state = useLoad(() => api.carriers(), [version])
  const [editing, setEditing] = useState<CarrierInfo | null>(null)
  const can = useCan()("SETTINGS_MANAGE")
  return <Card icon={Truck} title="Transportadoras" subtitle="Las que aparecen al enviar con guía, y el enlace con el que el cliente rastrea su pedido"
    actions={can && !editing ? <button type="button" className="glass-chip" onClick={() => setEditing({ ...blank })}><Plus size={14} aria-hidden="true" />Agregar</button> : undefined}>
    {editing ? <CarrierForm initial={editing} isNew={!editing.code} onDone={() => { setEditing(null); setVersion(v => v + 1) }} onCancel={() => setEditing(null)} />
      : <Async state={state} label="Cargando transportadoras" rows={4}>{(list: CarrierInfo[]) => <ul className="carrier-rows">{list.map(c => {
        const link = linkFor(c, SAMPLE)
        return <li key={c.code} data-off={!c.active || undefined}>
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2"><strong>{c.name}</strong>{!c.active && <Badge tone="neutral">Oculta</Badge>}{c.linkTemplate ? <Badge tone="good">Abre la guía</Badge> : <Badge tone="neutral">Solo su página</Badge>}{c.trackingKey ? <Badge tone="info">17TRACK</Badge> : null}</p>
            <p className="truncate text-xs text-stone-500">{c.linkTemplate ?? c.pageUrl ?? "Sin enlace"}</p>
          </div>
          {link && <a className="glass-chip" href={link} target="_blank" rel="noopener noreferrer" title="Abre el enlace con una guía de ejemplo"><ArrowSquareOut size={14} aria-hidden="true" />Probar</a>}
          {can && <button type="button" className="glass-chip" onClick={() => setEditing(c)}><PencilSimple size={14} aria-hidden="true" />Editar</button>}
        </li>
      })}</ul>}</Async>}
  </Card>
}

function CarrierForm({ initial, isNew, onDone, onCancel }: { initial: CarrierInfo; isNew: boolean; onDone: () => void; onCancel: () => void }) {
  const api = useFulfillmentPort()
  const { csrf, notify } = useSession()
  const [c, setC] = useState<CarrierInfo>(initial)
  const [busy, setBusy] = useState(false), [error, setError] = useState("")
  const [sample, setSample] = useState("")
  const set = <K extends keyof CarrierInfo>(k: K, v: CarrierInfo[K]) => setC(x => ({ ...x, [k]: v }))
  const code = isNew ? c.name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30) : c.code
  const test = linkFor(c, sample || SAMPLE)
  async function save(e: FormEvent) {
    e.preventDefault(); setError("")
    if (c.linkTemplate && !c.linkTemplate.includes(NUMBER_SLOT)) { setError(`El enlace con la guía debe llevar ${NUMBER_SLOT} donde va el número.`); return }
    if (!c.linkTemplate && !c.pageUrl) { setError("Pon al menos la página de rastreo de la transportadora."); return }
    setBusy(true)
    try { await api.saveCarrier({ ...c, code, aliases: c.aliases }, csrf); notify(`${c.name} guardada.`); onDone() }
    catch (err) { setError(err instanceof Error ? err.message : "No se pudo guardar") } finally { setBusy(false) }
  }
  return <form className="grid gap-4" onSubmit={save} noValidate>
    {error && <p role="alert" className="glass-alert">{error}</p>}
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="glass-label">Nombre<input className="glass-field" value={c.name} maxLength={60} onChange={e => set("name", e.target.value)} placeholder="Ej. Servientrega" autoFocus /></label>
      <label className="glass-label">Ayuda para el número (opcional)<input className="glass-field" value={c.numberHint} maxLength={80} onChange={e => set("numberHint", e.target.value)} placeholder="Ej. Número de 11 dígitos" /></label>
    </div>
    <label className="glass-label">Enlace que abre la guía (opcional)
      <input className="glass-field" value={c.linkTemplate ?? ""} onChange={e => set("linkTemplate", e.target.value || null)} placeholder={`https://…?guia=${NUMBER_SLOT}`} spellCheck={false} />
      <span className="text-xs text-stone-500">Si la página de la transportadora recibe el número en la dirección, ponlo con {NUMBER_SLOT} donde va el número. Búscalo rastreando una guía real y copiando la dirección que queda.</span>
    </label>
    <label className="glass-label">Página de rastreo<input className="glass-field" value={c.pageUrl ?? ""} onChange={e => set("pageUrl", e.target.value || null)} placeholder="https://…" spellCheck={false} /></label>
    <div className="flex flex-wrap items-end gap-2">
      <label className="glass-label min-w-0 flex-1">Probar con una guía real<input className="glass-field" value={sample} onChange={e => setSample(e.target.value)} placeholder={SAMPLE} /></label>
      {test && <a className="glass-chip" href={test} target="_blank" rel="noopener noreferrer"><ArrowSquareOut size={14} aria-hidden="true" />Probar enlace</a>}
    </div>
    <Switch checked={c.active} onChange={v => set("active", v)} title="Mostrarla al enviar con guía" hint="Oculta la deja guardada para los pedidos que ya la usaron." />
    <div className="flex flex-wrap justify-end gap-2"><button type="button" className="glass-chip" disabled={busy} onClick={onCancel}>Cancelar</button><button className="glass-cta" disabled={busy || c.name.trim().length < 2 || code.length < 2}>{busy ? "Guardando…" : "Guardar"}</button></div>
  </form>
}

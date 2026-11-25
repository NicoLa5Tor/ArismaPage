"use client"

import { useEffect, useState } from "react"
import { ArrowDown, ArrowUp, Code, FilePdf, Plus, Scales, Sparkle, Trash, UploadSimple } from "@phosphor-icons/react"
import { useSession, usePort } from "../../shared/ui/admin-context"
import { Async, Badge, Card, useLoad } from "../../shared/ui/parts"
import { Switch, TabPanel, Tabs } from "../../shared/ui/rich"
import { useStoreProfile } from "../../shared/ui/store-profile"
import { ErrorFrame } from "../../shared/ui/error-frame"
import { LEGAL_LABELS, LEGAL_PATHS, type LegalBlock, type LegalKind, type LegalPage } from "../../shared/domain/legal"
import { STORE_CLASSES, STORE_SCRIPT, STORE_VARIABLES, type ErrorPageKind } from "../../shared/domain/error-page"
import type { SitePort } from "../application/site-port"
import { ERROR_PAGE_EXAMPLE, isEmpty, pdfName, type ErrorPages, type LegalOverview, type StoredErrorPage } from "../domain/site"

const useSite = () => usePort<SitePort>("site")
const message = (e: unknown) => (e instanceof Error ? e.message : "No se pudo guardar")
const date = (iso: string) => new Date(iso).toLocaleString("es-CO", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Bogota" })
const BLOCK_KINDS: { value: LegalBlock["kind"]; label: string }[] = [{ value: "heading", label: "Título" }, { value: "subheading", label: "Subtítulo" }, { value: "paragraph", label: "Párrafo" }, { value: "list", label: "Lista" }]

type Tab = "legal" | "errors"

/** Panel section «Sitio»: the store's legal documents and its own error pages. */
export function SiteSection() {
  const [tab, setTab] = useState<Tab>("legal")
  return <div className="glass-scroll">
    <Tabs label="Sitio" value={tab} onChange={setTab} tabs={[{ id: "legal", label: "Documentos legales" }, { id: "errors", label: "Páginas de error" }]} />
    <TabPanel active={tab === "legal"}><LegalDocuments /></TabPanel>
    <TabPanel active={tab === "errors"}><ErrorPagesPanel /></TabPanel>
  </div>
}

function LegalDocuments() {
  const api = useSite()
  const state = useLoad(() => api.legal(), [])
  const [kind, setKind] = useState<LegalKind>("terms")
  const [data, setData] = useState<LegalOverview[] | null>(null)
  useEffect(() => { if (state.data) setData(state.data) }, [state.data])
  return <Async state={state} label="Cargando documentos" rows={4}>{() => {
    const all = data ?? state.data ?? []
    const missing = all.filter(d => (d.kind === "terms" || d.kind === "privacy") && !d.published)
    const current = all.find(d => d.kind === kind)
    return <div className="grid gap-4">
      {missing.length > 0 && <p role="status" className="glass-alert">Publica {missing.map(m => LEGAL_LABELS[m.kind].toLowerCase()).join(" y ")} antes de vender: los clientes los aceptan al comprar y al crear su cuenta.</p>}
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4" role="tablist" aria-label="Documento">
        {all.map(d => <button key={d.kind} type="button" role="tab" aria-selected={d.kind === kind} onClick={() => setKind(d.kind)} className="glass-subpanel text-left" data-active={d.kind === kind || undefined}
          style={{ outline: d.kind === kind ? "2px solid rgba(106,166,255,.8)" : undefined }}>
          <span className="block text-sm font-semibold">{LEGAL_LABELS[d.kind]}</span>
          <span className="mt-2 flex flex-wrap gap-2"><Status doc={d} /></span>
        </button>)}
      </div>
      {current && <LegalEditor key={`${current.kind}-${current.published?.version ?? 0}`} doc={current} onChanged={setData} />}
    </div>
  }}</Async>
}

function Status({ doc }: { doc: LegalOverview }) {
  if (!doc.published) return isEmpty(doc.draft) ? <Badge tone="neutral">Sin escribir</Badge> : <Badge tone="warn">Borrador sin publicar</Badge>
  return <><Badge tone="good">Publicado v{doc.published.version}</Badge>{doc.changed && <Badge tone="warn">Cambios sin publicar</Badge>}</>
}

/** Plain text in blocks, never HTML: what shoppers read is exactly what is written here. */
function LegalEditor({ doc, onChanged }: { doc: LegalOverview; onChanged: (all: LegalOverview[]) => void }) {
  const api = useSite()
  const { csrf, notify } = useSession()
  const [page, setPage] = useState<LegalPage>(doc.draft)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [confirm, setConfirm] = useState(false)
  const change = (next: LegalPage) => { setPage(next); setDirty(true) }
  const setBlock = (i: number, block: LegalBlock) => change({ ...page, blocks: page.blocks.map((b, j) => (j === i ? block : b)) })
  const move = (i: number, by: number) => { const blocks = [...page.blocks]; const [b] = blocks.splice(i, 1); blocks.splice(i + by, 0, b); change({ ...page, blocks }) }

  async function run(action: () => Promise<LegalOverview[]>, done: string) {
    setBusy(true); setError("")
    try { const all = await action(); onChanged(all); const mine = all.find(d => d.kind === doc.kind); if (mine) setPage(mine.draft); setDirty(false); setConfirm(false); notify(done) }
    catch (e) { setError(message(e)) } finally { setBusy(false) }
  }
  async function upload(file: File | undefined) {
    if (!file) return
    if (file.type && file.type !== "application/pdf") { setError("Sube un archivo PDF"); return }
    setBusy(true); setError("")
    try {
      const name = await api.uploadPdf(pdfName(file.name), file, csrf)
      change({ ...page, documents: [...page.documents.filter(d => d.file !== name), { title: file.name.replace(/\.pdf$/i, ""), file: name }] })
      notify("PDF subido. Guarda el borrador para adjuntarlo.")
    } catch (e) { setError(message(e)) } finally { setBusy(false) }
  }

  const canPublish = !isEmpty(page) && !dirty && (doc.changed || !doc.published)
  return <Card icon={Scales} title={LEGAL_LABELS[doc.kind]} subtitle={<>Se publica en <a className="glass-link" href={LEGAL_PATHS[doc.kind]} target="_blank" rel="noopener noreferrer">{LEGAL_PATHS[doc.kind]}</a>. Los clientes leen y aceptan la última versión publicada; cada versión queda guardada con la fecha.</>}
    actions={isEmpty(page) ? <button type="button" className="glass-chip" disabled={busy} onClick={() => void run(() => api.generateDraft(doc.kind, csrf), "Borrador creado con las reglas de tu tienda. Revísalo antes de publicarlo.")}><Sparkle size={16} aria-hidden="true" /> Crear borrador con las reglas de la tienda</button> : undefined}>
    <div className="mt-4 grid gap-4">
      {error && <p role="alert" className="glass-alert">{error}</p>}
      {isEmpty(page) && <p className="text-sm text-stone-500">El borrador sugerido sale de tu perfil, tus envíos, tus pagos y la regla de cancelación, más lo que exige la ley colombiana. Es un punto de partida: revísalo con tu abogado.</p>}
      <label className="glass-label">Título<input className="glass-field" value={page.title} maxLength={120} onChange={e => change({ ...page, title: e.target.value })} /></label>
      {page.blocks.map((block, i) => <div key={i} className="glass-subpanel grid gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <select className="glass-field w-auto" aria-label={`Tipo del bloque ${i + 1}`} value={block.kind} onChange={e => {
            const kind = e.target.value as LegalBlock["kind"]
            const text = block.kind === "list" ? block.items.join("\n") : block.text
            setBlock(i, kind === "list" ? { kind, items: text.split("\n").filter(Boolean) } : { kind, text })
          }}>{BLOCK_KINDS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}</select>
          <span className="flex-1" />
          <button type="button" className="glass-icon-button" aria-label="Subir bloque" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={16} aria-hidden="true" /></button>
          <button type="button" className="glass-icon-button" aria-label="Bajar bloque" disabled={i === page.blocks.length - 1} onClick={() => move(i, 1)}><ArrowDown size={16} aria-hidden="true" /></button>
          <button type="button" className="glass-icon-button glass-icon-danger" aria-label="Quitar bloque" onClick={() => change({ ...page, blocks: page.blocks.filter((_, j) => j !== i) })}><Trash size={16} aria-hidden="true" /></button>
        </div>
        {block.kind === "list"
          ? <label className="glass-label">Un punto por línea<textarea className="glass-field" rows={Math.max(3, block.items.length + 1)} value={block.items.join("\n")} onChange={e => setBlock(i, { kind: "list", items: e.target.value.split("\n") })} /></label>
          : <textarea className="glass-field" aria-label={`Texto del bloque ${i + 1}`} rows={block.kind === "paragraph" ? 4 : 1} value={block.text} onChange={e => setBlock(i, { kind: block.kind, text: e.target.value })} />}
      </div>)}
      <div className="flex flex-wrap gap-2">
        {BLOCK_KINDS.map(k => <button key={k.value} type="button" className="glass-chip" onClick={() => change({ ...page, blocks: [...page.blocks, k.value === "list" ? { kind: "list", items: [""] } : { kind: k.value, text: "" }] })}><Plus size={14} aria-hidden="true" /> {k.label}</button>)}
      </div>

      <div className="grid gap-2">
        <h3 className="text-sm font-semibold">Documentos adjuntos</h3>
        {page.documents.map((d, i) => <div key={d.file} className="glass-subpanel flex flex-wrap items-center gap-2">
          <FilePdf size={20} aria-hidden="true" />
          <input className="glass-field min-w-0 flex-1" aria-label="Nombre del documento" value={d.title} maxLength={120} onChange={e => change({ ...page, documents: page.documents.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })} />
          <a className="glass-link text-sm" href={api.pdfHref(d.file)} target="_blank" rel="noopener noreferrer">Ver</a>
          <button type="button" className="glass-icon-button glass-icon-danger" aria-label={`Quitar ${d.title}`} onClick={() => change({ ...page, documents: page.documents.filter((_, j) => j !== i) })}><Trash size={16} aria-hidden="true" /></button>
        </div>)}
        <label className="glass-chip w-fit cursor-pointer"><UploadSimple size={16} aria-hidden="true" /> Subir PDF<input type="file" accept="application/pdf" className="sr-only" disabled={busy} onChange={e => { void upload(e.target.files?.[0]); e.target.value = "" }} /></label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="glass-cta" disabled={busy || !dirty} onClick={() => void run(() => api.saveDraft(doc.kind, { ...page, blocks: page.blocks.map(b => b.kind === "list" ? { kind: "list", items: b.items.map(x => x.trim()).filter(Boolean) } : b) }, csrf), "Borrador guardado. Los clientes siguen viendo la versión publicada.")}>{busy ? "Guardando…" : "Guardar borrador"}</button>
        {confirm
          ? <span className="glass-confirm-inline" role="alertdialog" aria-label="Confirmar publicación"><span>Desde ahora los clientes leen y aceptan esta versión.</span>
            <button type="button" className="glass-chip glass-chip-primary" disabled={busy} onClick={() => void run(() => api.publish(doc.kind, csrf), "Publicado. La tienda ya muestra esta versión.")}>Publicar</button>
            <button type="button" className="glass-chip" onClick={() => setConfirm(false)}>No</button></span>
          : <button type="button" className="glass-chip" disabled={busy || !canPublish} onClick={() => setConfirm(true)}>Publicar{doc.published ? ` versión ${doc.published.version + 1}` : ""}</button>}
        {dirty && <span className="text-xs text-stone-500">Guarda el borrador antes de publicarlo.</span>}
      </div>

      {doc.history.length > 0 && <details className="glass-subpanel">
        <summary className="cursor-pointer text-sm font-semibold">Versiones publicadas ({doc.history.length})</summary>
        <ol className="mt-2 grid gap-1 text-sm">{doc.history.map(v => <li key={v.version}>Versión {v.version} · {v.title} · {date(v.publishedAt)}</li>)}</ol>
      </details>}
    </div>
  </Card>
}

function ErrorPagesPanel() {
  const api = useSite()
  const state = useLoad(() => api.errorPages(), [])
  const [kind, setKind] = useState<ErrorPageKind>("not_found")
  const [saved, setSaved] = useState<ErrorPages | null>(null)
  useEffect(() => { if (state.data) setSaved(state.data) }, [state.data])
  return <Async state={state} label="Cargando páginas" rows={3}>{() => {
    const pages = saved ?? state.data!
    return <div className="grid gap-4">
      <Tabs label="Página" value={kind} onChange={setKind} tabs={[{ id: "not_found", label: `Página no encontrada (404)${pages.not_found.enabled ? " · activa" : ""}` }, { id: "error", label: `Error del sitio${pages.error.enabled ? " · activa" : ""}` }]} />
      <ErrorPageEditor key={kind} kind={kind} initial={pages[kind]} onSaved={setSaved} />
      <Reference />
    </div>
  }}</Async>
}

function ErrorPageEditor({ kind, initial, onSaved }: { kind: ErrorPageKind; initial: StoredErrorPage; onSaved: (pages: ErrorPages) => void }) {
  const api = useSite()
  const { csrf, notify } = useSession()
  const profile = useStoreProfile()
  const [page, setPage] = useState<StoredErrorPage>(initial)
  const [preview, setPreview] = useState<StoredErrorPage>(initial)
  const [busy, setBusy] = useState(false), [error, setError] = useState("")
  const set = (key: "html" | "css" | "js", value: string) => setPage(p => ({ ...p, [key]: value }))
  // the preview follows the code a moment after typing stops
  useEffect(() => { const t = setTimeout(() => setPreview(page), 600); return () => clearTimeout(t) }, [page])
  async function save(next: StoredErrorPage) {
    setBusy(true); setError("")
    try { const all = await api.saveErrorPage(kind, next, csrf); onSaved(all); setPage(all[kind]); notify(next.enabled ? "Guardada. La tienda ya muestra tu página." : "Guardada. La tienda muestra su página de siempre.") }
    catch (e) { setError(message(e)) } finally { setBusy(false) }
  }
  const field = (key: "html" | "css" | "js", label: string, rows: number) =>
    <label className="glass-label">{label}<textarea className="glass-field font-mono text-xs" spellCheck={false} rows={rows} value={page[key]} onChange={e => set(key, e.target.value)} /></label>
  return <Card icon={Code} title={kind === "not_found" ? "Página no encontrada" : "Error del sitio"}
    subtitle={kind === "not_found" ? "La ve quien abre una dirección que no existe en la tienda." : "La ve el cliente cuando algo falla al cargar una página."}
    actions={!page.html.trim() ? <button type="button" className="glass-chip" onClick={() => setPage(p => ({ ...p, ...ERROR_PAGE_EXAMPLE[kind] }))}><Sparkle size={16} aria-hidden="true" /> Empezar con un ejemplo</button> : undefined}>
    <div className="mt-4 grid gap-4">
      {error && <p role="alert" className="glass-alert">{error}</p>}
      <Switch title="Mostrar esta página en la tienda" hint="Apagada, la tienda muestra su página de siempre. Tu código se guarda igual." checked={page.enabled} onChange={v => setPage(p => ({ ...p, enabled: v }))} />
      <p className="text-xs text-stone-500">Tu código corre en un marco aislado: usa los estilos de la tienda y el ayudante <code>tienda</code>, pero no puede leer la sesión del cliente ni tocar el resto de la página. Los enlaces abren en la ventana completa. Puedes cargar librerías con &lt;script src&gt;.</p>
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="grid gap-4">
          {field("html", "HTML", 12)}
          {field("css", "CSS", 6)}
          {field("js", "JavaScript", 6)}
        </div>
        <div className="grid content-start gap-2">
          <span className="text-sm font-semibold">Vista previa</span>
          {preview.html.trim()
            ? <div className="overflow-hidden rounded-2xl bg-stone-100"><ErrorFrame page={preview} store={{ name: profile.name, whatsapp: profile.whatsapp }} path="/una-direccion-que-no-existe" title="Vista previa de la página de error" onRetry={() => notify("En la tienda, esto vuelve a cargar la página.")} /></div>
            : <p className="glass-subpanel text-sm text-stone-500">Escribe el HTML o empieza con el ejemplo para verla aquí.</p>}
        </div>
      </div>
      <div><button type="button" className="glass-cta" disabled={busy} onClick={() => void save(page)}>{busy ? "Guardando…" : "Guardar"}</button></div>
    </div>
  </Card>
}

/** What the page can use without bringing anything: the store's classes, its CSS variables and the `tienda` helper. */
function Reference() {
  const list = (items: { name: string; use: string }[]) => <dl className="grid gap-2 text-sm">{items.map(i => <div key={i.name}><dt><code>{i.name}</code></dt><dd className="text-stone-500">{i.use}</dd></div>)}</dl>
  return <Card icon={Code} title="Lo que ya puedes usar" subtitle="Sin importar nada: ya está cargado en el marco de la página">
    <div className="mt-4 grid gap-4 lg:grid-cols-3">
      <div className="glass-subpanel grid gap-2"><h3 className="text-sm font-semibold">Clases de la tienda</h3>{list(STORE_CLASSES)}</div>
      <div className="glass-subpanel grid gap-2"><h3 className="text-sm font-semibold">Variables CSS</h3>{list(STORE_VARIABLES)}</div>
      <div className="glass-subpanel grid gap-2"><h3 className="text-sm font-semibold">JavaScript: el objeto tienda</h3>{list(STORE_SCRIPT)}</div>
    </div>
  </Card>
}


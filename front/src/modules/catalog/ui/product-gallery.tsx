"use client"

import { useEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent } from "react"
import { ArrowLeft, ArrowRight, ArrowSquareOut, CaretLeft, CaretRight, CloudArrowUp, ImageSquare, Star, Trash, WarningCircle, X, CircleNotch, Check } from "@phosphor-icons/react"
import type { ProductImage } from "../domain/catalog"
import { MAX_IMAGES, move, rejectFile } from "../domain/gallery"
import { useSession } from "../../shared/ui/admin-context"
import { useMedia } from "../../shared/ui/rich"
import { useCatalogPort } from "./use-catalog"

type Upload = { key: string; name: string; state: "waiting" | "uploading" | "done" | "error"; error?: string; file: File }
const kb = (n: number | null) => n == null ? "" : n >= 1048576 ? `${(n / 1048576).toLocaleString("es-CO", { maximumFractionDigits: 1 })} MB` : `${Math.round(n / 1024)} KB`

/** Drop zone shared by the saved gallery and the "new product" queue. */
function DropZone({ onFiles, compact, disabled }: { onFiles: (files: File[]) => void; compact?: boolean; disabled?: boolean }) {
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const drop = (e: DragEvent) => { e.preventDefault(); setOver(false); if (!disabled) onFiles(Array.from(e.dataTransfer.files)) }
  return <div className="glass-dropzone" data-over={over || undefined} data-compact={compact || undefined} data-disabled={disabled || undefined}
    onDragOver={e => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setOver(true) } }} onDragLeave={() => setOver(false)} onDrop={drop}>
    <CloudArrowUp size={compact ? 22 : 36} aria-hidden="true" />
    <div><p className="font-semibold">{compact ? "Agregar más imágenes" : "Arrastra las fotos aquí"}</p>{!compact && <p className="mt-1 text-xs text-stone-500">JPEG, PNG o WebP de hasta 5 MB. Puedes elegir varias a la vez.</p>}</div>
    <button type="button" className="glass-chip" disabled={disabled} onClick={() => input.current?.click()}>Elegir archivos</button>
    <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={e => { onFiles(Array.from(e.target.files ?? [])); e.target.value = "" }} />
  </div>
}

/** Before the product exists: files wait here and upload right after the first save. */
export function QueuedGallery({ files, onAdd, onRemove }: { files: File[]; onAdd: (files: File[]) => void; onRemove: (index: number) => void }) {
  const [errors, setErrors] = useState<string[]>([])
  const previews = useMemo(() => files.map(f => URL.createObjectURL(f)), [files])
  useEffect(() => () => previews.forEach(u => URL.revokeObjectURL(u)), [previews])
  const add = (incoming: File[]) => {
    const bad = incoming.map(f => [f.name, rejectFile(f)] as const).filter(([, e]) => e)
    setErrors(bad.map(([n, e]) => `${n}: ${e}`))
    onAdd(incoming.filter(f => !rejectFile(f)).slice(0, MAX_IMAGES - files.length))
  }
  return <section className="glass-gallery" aria-label="Imágenes del producto">
    {files.length === 0 ? <DropZone onFiles={add} /> : <>
      <div className="glass-gallery-stage"><img src={previews[0]} alt="" /><span className="glass-stage-badge"><Star size={14} weight="fill" aria-hidden="true" />Principal</span></div>
      <ul className="glass-thumbs">{files.map((f, i) => <li key={`${f.name}-${i}`}><span className="glass-thumb-item">{previews[i] && <img src={previews[i]} alt="" />}</span>
        <button type="button" className="glass-thumb-remove" aria-label={`Quitar ${f.name}`} onClick={() => onRemove(i)}><X size={12} aria-hidden="true" /></button></li>)}</ul>
      <DropZone onFiles={add} compact />
    </>}
    <p className="glass-gallery-note">La primera foto será la principal. Se subirán al guardar el producto.</p>
    {errors.map(e => <p key={e} role="alert" className="glass-inline-error"><WarningCircle size={14} aria-hidden="true" />{e}</p>)}
  </section>
}

/** Saved product gallery: view, upload, choose the primary photo, reorder, describe and delete. */
export function ProductGallery({ productId, productTitle, onChange, readOnly = false }: { productId: string; productTitle: string; onChange?: (images: ProductImage[]) => void; readOnly?: boolean }) {
  const api = useCatalogPort()
  const media = useMedia()
  const { csrf } = useSession()
  const [images, setImages] = useState<ProductImage[] | null>(null)
  const [error, setError] = useState("")
  const [selected, setSelected] = useState(0)
  const [uploads, setUploads] = useState<Upload[]>([])
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  // Alt text draft belongs to one image; switching images shows that image's saved text.
  const [draft, setDraft] = useState<{ id: string; value: string; state: "idle" | "saving" | "saved" } | null>(null)
  const dragFrom = useRef<number | null>(null)
  const changeRef = useRef(onChange); useEffect(() => { changeRef.current = onChange })

  const apply = (next: ProductImage[], select?: number) => { setImages(next); changeRef.current?.(next); if (select != null) setSelected(Math.max(0, Math.min(select, next.length - 1))) }
  useEffect(() => { let active = true; api.listImages(productId).then(i => { if (active) apply(i, 0) }).catch(e => { if (active) setError(e instanceof Error ? e.message : "No se pudieron cargar las imágenes") }); return () => { active = false } }, [api, productId])
  const current = images?.[selected] ?? null
  const alt = draft && draft.id === current?.id ? draft.value : current?.alt ?? ""
  const altState = draft && draft.id === current?.id ? draft.state : "idle"
  const select = (i: number) => { setSelected(i); setConfirmDelete(false) }

  async function run(action: () => Promise<ProductImage[]>, select?: (next: ProductImage[]) => number) {
    setBusy(true); setError("")
    try { const next = await action(); apply(next, select ? select(next) : selected); return true } catch (e) { setError(e instanceof Error ? e.message : "No se pudo completar la acción"); return false } finally { setBusy(false) }
  }
  // Uploads go one by one so each file shows its own state and a failure does not stop the rest.
  async function upload(files: File[]) {
    const room = MAX_IMAGES - (images?.length ?? 0)
    const batch: Upload[] = files.map((file, i): Upload => ({ key: `${Date.now()}-${i}-${file.name}`, name: file.name, file, state: "waiting", error: rejectFile(file) ?? (i >= room ? "Se alcanzó el máximo de imágenes" : undefined) }))
      .map((u): Upload => u.error ? { ...u, state: "error" } : u)
    setUploads(list => [...list.filter(u => u.state !== "done"), ...batch])
    for (const u of batch.filter(b => b.state === "waiting")) {
      setUploads(list => list.map(x => x.key === u.key ? { ...x, state: "uploading" } : x))
      try { const next = await api.uploadImage(productId, u.file, productTitle, csrf); apply(next, next.length - 1); setUploads(list => list.map(x => x.key === u.key ? { ...x, state: "done" } : x)) }
      catch (e) { setUploads(list => list.map(x => x.key === u.key ? { ...x, state: "error", error: e instanceof Error ? e.message : "No se pudo subir" } : x)) }
    }
  }
  const reorder = (from: number, to: number) => {
    if (!images || from === to) return
    const optimistic = move(images, from, to - from)
    apply(optimistic, to)
    void run(() => api.reorderImages(productId, optimistic.map(i => i.id), csrf), () => to)
  }
  const saveAlt = () => { if (!current || alt.trim() === current.alt) return; const id = current.id; setDraft({ id, value: alt, state: "saving" }); void run(() => api.describeImage(productId, id, alt, csrf)).then(ok => setDraft(d => d && d.id === id ? { ...d, state: ok ? "saved" : "idle" } : d)) }
  const onStageKey = (e: KeyboardEvent) => { if (!images?.length) return; if (e.key === "ArrowRight") { e.preventDefault(); select((selected + 1) % images.length) } if (e.key === "ArrowLeft") { e.preventDefault(); select((selected - 1 + images.length) % images.length) } }
  const src = (img: ProductImage) => media.src({ productId, imageId: img.id, imageUrl: img.originalUrl, imageUploaded: img.uploaded })

  if (error && !images) return <div role="alert" className="glass-alert">{error}</div>
  if (!images) return <div className="glass-gallery"><div className="glass-gallery-stage glass-skeleton-block" role="status" aria-label="Cargando imágenes" /></div>
  return <section className="glass-gallery" aria-label="Imágenes del producto">
    {images.length === 0 ? (readOnly ? <p className="glass-gallery-note">Este producto aún no tiene fotos.</p> : <DropZone onFiles={files => void upload(files)} />) : <>
      <div className="glass-gallery-stage" tabIndex={0} role="group" aria-roledescription="carrusel" aria-label={`Imagen ${selected + 1} de ${images.length}. Usa las flechas para cambiar.`} onKeyDown={onStageKey}
        onDragOver={e => { if (e.dataTransfer.types.includes("Files")) e.preventDefault() }} onDrop={e => { if (!readOnly && e.dataTransfer.files.length) { e.preventDefault(); void upload(Array.from(e.dataTransfer.files)) } }}>
        {current && <img key={current.id} src={src(current) ?? ""} alt={current.alt || productTitle} />}
        {current?.isPrimary && <span className="glass-stage-badge"><Star size={14} weight="fill" aria-hidden="true" />Principal</span>}
        <span className="glass-stage-count">{selected + 1} / {images.length}</span>
        {images.length > 1 && <><button type="button" className="glass-stage-nav" data-side="left" aria-label="Imagen anterior" onClick={() => select((selected - 1 + images.length) % images.length)}><CaretLeft size={20} aria-hidden="true" /></button>
          <button type="button" className="glass-stage-nav" data-side="right" aria-label="Imagen siguiente" onClick={() => select((selected + 1) % images.length)}><CaretRight size={20} aria-hidden="true" /></button></>}
      </div>
      <ul className="glass-thumbs" aria-label="Orden de las imágenes. Arrastra para reordenar.">{images.map((img, i) => <li key={img.id}
        draggable={!readOnly} onDragStart={e => { dragFrom.current = i; e.dataTransfer.effectAllowed = "move" }} onDragOver={e => { if (dragFrom.current != null) e.preventDefault() }}
        onDrop={e => { e.preventDefault(); if (dragFrom.current != null) reorder(dragFrom.current, i); dragFrom.current = null }}>
        <button type="button" className="glass-thumb-item" aria-pressed={i === selected} aria-label={`Ver imagen ${i + 1}${img.isPrimary ? ", principal" : ""}`} onClick={() => select(i)}>
          <img src={src(img) ?? ""} alt="" loading="lazy" />{img.isPrimary && <Star size={12} weight="fill" className="glass-thumb-star" aria-hidden="true" />}
        </button></li>)}</ul>
      {current && !readOnly && <div className="glass-gallery-tools">
        <div className="flex flex-wrap gap-2">
          <button type="button" className="glass-chip" disabled={busy || current.isPrimary} onClick={() => void run(() => api.setPrimaryImage(productId, current.id, csrf), () => 0)}><Star size={16} aria-hidden="true" />{current.isPrimary ? "Es la principal" : "Usar como principal"}</button>
          <button type="button" className="glass-icon-button" aria-label="Mover a la izquierda" disabled={busy || selected === 0} onClick={() => reorder(selected, selected - 1)}><ArrowLeft size={16} aria-hidden="true" /></button>
          <button type="button" className="glass-icon-button" aria-label="Mover a la derecha" disabled={busy || selected === images.length - 1} onClick={() => reorder(selected, selected + 1)}><ArrowRight size={16} aria-hidden="true" /></button>
          {current.originalUrl && <a className="glass-icon-button" href={current.originalUrl} target="_blank" rel="noreferrer" aria-label="Abrir la imagen original en otra pestaña"><ArrowSquareOut size={16} aria-hidden="true" /></a>}
          {confirmDelete ? <span className="glass-confirm-inline" role="alertdialog" aria-label="Confirmar eliminación"><span>{current.uploaded ? "¿Eliminar la foto?" : "¿Quitarla del producto?"}</span>
            <button type="button" className="glass-chip glass-chip-danger" disabled={busy} onClick={() => void run(() => api.deleteImage(productId, current.id, csrf), () => selected - 1)}>Sí, eliminar</button><button type="button" className="glass-chip" onClick={() => setConfirmDelete(false)}>No</button></span>
            : <button type="button" className="glass-icon-button glass-icon-danger" aria-label="Eliminar imagen" disabled={busy} onClick={() => setConfirmDelete(true)}><Trash size={16} aria-hidden="true" /></button>}
        </div>
        <label className="glass-label text-xs">Texto alternativo (lo leen lectores de pantalla y buscadores)
          <span className="relative block"><input className="glass-field pr-12" maxLength={200} value={alt} placeholder={productTitle} onChange={e => current && setDraft({ id: current.id, value: e.target.value, state: "idle" })} onBlur={saveAlt} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); saveAlt() } }} />
            <span className="glass-field-status" aria-live="polite">{altState === "saving" ? <CircleNotch size={16} className="animate-spin" aria-label="Guardando" /> : altState === "saved" ? <Check size={16} aria-label="Guardado" /> : null}</span></span></label>
        <p className="text-xs text-stone-500">{current.uploaded ? `Subida al panel · ${kb(current.byteSize)}` : "Foto del sitio anterior"} · Arrastra las miniaturas para cambiar el orden</p>
      </div>}
      {!readOnly && images.length < MAX_IMAGES && <DropZone onFiles={files => void upload(files)} compact disabled={busy} />}
    </>}
    {error && <p role="alert" className="glass-inline-error"><WarningCircle size={14} aria-hidden="true" />{error}</p>}
    {uploads.length > 0 && <ul className="glass-uploads" aria-label="Subidas">{uploads.map(u => <li key={u.key} data-state={u.state}>
      {u.state === "uploading" || u.state === "waiting" ? <CircleNotch size={16} className={u.state === "uploading" ? "animate-spin" : ""} aria-hidden="true" /> : u.state === "done" ? <Check size={16} aria-hidden="true" /> : <WarningCircle size={16} aria-hidden="true" />}
      <span className="min-w-0 flex-1 truncate">{u.name}</span><span className="text-xs">{u.state === "waiting" ? "En espera" : u.state === "uploading" ? "Subiendo…" : u.state === "done" ? "Lista" : u.error}</span>
      {(u.state === "error" || u.state === "done") && <button type="button" className="glass-icon-button" aria-label={`Quitar ${u.name} de la lista`} onClick={() => setUploads(l => l.filter(x => x.key !== u.key))}><X size={12} aria-hidden="true" /></button>}
    </li>)}</ul>}
    {images.length === 0 && <p className="glass-gallery-note"><ImageSquare size={14} aria-hidden="true" className="mr-1 inline" />La primera foto que subas será la principal.</p>}
  </section>
}

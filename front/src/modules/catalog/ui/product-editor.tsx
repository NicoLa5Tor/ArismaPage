"use client"

import { useEffect, useMemo, useState, type FormEvent } from "react"
import { Archive, Eye, FileDashed, ImageSquare, MagnifyingGlass, Sparkle, Tag, X } from "@phosphor-icons/react"
import type { Backorders, Category, Product, ProductImage, ProductStatus, StockStatus, TaxRate } from "../domain/catalog"
import { withoutTax, withTax } from "../domain/pricing"
import { slugify } from "../domain/gallery"
import { type AgeDraft, type ProductSearchProfile, ageDraft, ageError, ageLabel, toProfile } from "../domain/search-profile"
import { count, money, plural } from "../../shared/ui/format"
import { Badge, Dialog, Failure, Loading, type Tone } from "../../shared/ui/parts"
import { Segmented, Stepper, Switch, TabPanel, Tabs, Thumb, useMedia } from "../../shared/ui/rich"
import { useCan, useSession } from "../../shared/ui/admin-context"
import { ProductGallery, QueuedGallery } from "./product-gallery"
import { AgeRange, KeywordInput } from "./search-fields"
import { cleanPage, emptyPage, pageError } from "../domain/product-page"
import { PageFields, type PageDraft } from "./page-fields"
import { useCatalogPort } from "./use-catalog"

type Tab = "general" | "price" | "stock" | "categories" | "page" | "search"
const noPage: PageDraft = { shortDescription: "", descriptionHtml: "", highlights: [], specs: [], sections: {} }
const noAge: AgeDraft = { ageMin: "", ageMax: "" }
type PriceField = { base: string; gross: string }
const emptyPrice: PriceField = { base: "", gross: "" }
const blank = { title: "", slug: "", status: "DRAFT" as ProductStatus, sku: "", taxRateId: "", regular: emptyPrice, onSale: false, sale: emptyPrice, saleStartsAt: "", saleEndsAt: "", manageStock: false, stockQuantity: "", stockStatus: "INSTOCK" as StockStatus, backorders: "NO" as Backorders, quoteOnly: false, hidePrice: false, featured: false, stockReason: "" }
type Form = typeof blank
const STATUS: Record<ProductStatus, { label: string; tone: Tone }> = { PUBLISHED: { label: "Publicado", tone: "good" }, DRAFT: { label: "Borrador", tone: "warn" }, ARCHIVED: { label: "Archivado", tone: "neutral" } }
const REASONS = ["Ingreso de mercancía", "Conteo físico", "Producto dañado", "Devolución de cliente"]
const num = (v: string) => v === "" ? null : Number(v)
const priceFrom = (base: number | null, percent: number): PriceField => base == null ? emptyPrice : { base: String(base), gross: String(withTax(base, percent)) }
const day = (iso: string | null) => iso ? new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Bogota" }) : ""
const startOf = (d: string) => d ? new Date(`${d}T00:00:00-05:00`).toISOString() : null
function fromProduct(p: Product): Form {
  const pct = p.taxPercent ?? 0
  return { title: p.title, slug: p.slug, status: p.status, sku: p.sku ?? "", taxRateId: p.taxRateId ?? "", regular: priceFrom(p.regularPrice, pct), onSale: p.salePrice != null, sale: priceFrom(p.salePrice, pct), saleStartsAt: day(p.saleStartsAt), saleEndsAt: day(p.saleEndsAt),
    manageStock: p.manageStock, stockQuantity: p.stockQuantity?.toString() ?? "", stockStatus: p.stockStatus, backorders: p.backorders, quoteOnly: p.quoteOnly, hidePrice: p.hidePrice, featured: p.featured, stockReason: "" }
}
/** Field errors grouped by tab, so the tab shows a dot and saving jumps to the first problem. */
function validate(f: Form, initialStock: string, age: AgeDraft): Partial<Record<keyof Form | "price" | "age", string>> {
  const e: Partial<Record<keyof Form | "price" | "age", string>> = {}
  const wrongAge = ageError(age)
  if (wrongAge) e.age = wrongAge
  if (!f.title.trim()) e.title = "Escribe el nombre del producto"
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(f.slug)) e.slug = "Solo minúsculas, números y guiones (ej. tablero-mini-arco)"
  if (f.status === "PUBLISHED" && f.regular.base === "" && !f.quoteOnly) e.price = "Un producto publicado necesita precio o ser solo de cotización"
  if (f.onSale && f.sale.base === "") e.sale = "Escribe el precio de oferta o desactiva la oferta"
  if (f.onSale && f.sale.base !== "" && f.regular.base !== "" && Number(f.sale.base) >= Number(f.regular.base)) e.sale = "La oferta debe ser menor que el precio normal"
  if (f.onSale && f.saleStartsAt && f.saleEndsAt && f.saleEndsAt <= f.saleStartsAt) e.saleEndsAt = "La oferta debe terminar después de empezar"
  if (f.manageStock && f.stockQuantity === "") e.stockQuantity = "Indica cuántas unidades hay"
  if (f.manageStock && f.stockQuantity !== initialStock && !f.stockReason.trim()) e.stockReason = "Cuéntanos por qué cambian las existencias"
  return e
}
const TAB_OF: Record<string, Tab> = { title: "general", slug: "general", price: "price", sale: "price", saleEndsAt: "price", stockQuantity: "stock", stockReason: "stock", age: "search" }

/** Two linked inputs: type either price, the other follows the product's tax rate. */
function PriceInputs({ label, value, percent, onChange, error }: { label: string; value: PriceField; percent: number; onChange: (v: PriceField) => void; error?: string }) {
  return <fieldset className="grid gap-2"><legend className="mb-2 text-sm font-semibold">{label}</legend><div className="grid gap-4 sm:grid-cols-2">
    <label className="glass-label">Con IVA · lo que paga el cliente<span className="glass-money"><span aria-hidden="true">$</span><input className="glass-field" type="number" min="0" step="1" inputMode="numeric" aria-invalid={!!error} value={value.gross} onChange={e => onChange({ gross: e.target.value, base: e.target.value === "" ? "" : String(withoutTax(Number(e.target.value), percent)) })} /></span></label>
    <label className="glass-label">Sin IVA · base guardada<span className="glass-money"><span aria-hidden="true">$</span><input className="glass-field" type="number" min="0" step="0.01" aria-invalid={!!error} value={value.base} onChange={e => onChange({ base: e.target.value, gross: e.target.value === "" ? "" : String(withTax(Number(e.target.value), percent)) })} /></span></label>
  </div>{error && <p className="glass-field-error">{error}</p>}</fieldset>
}

/** What the customer will see: the decisive check before saving. */
function Preview({ form, percent, title, src }: { form: Form; percent: number; title: string; src: string | null }) {
  const regular = num(form.regular.gross), sale = form.onSale ? num(form.sale.gross) : null
  const off = regular && sale ? Math.round((1 - sale / regular) * 100) : null
  const stock = form.manageStock ? (Number(form.stockQuantity) > 0 ? `${count(Number(form.stockQuantity))} disponibles` : form.backorders === "NO" ? "Agotado" : "Sobre pedido") : form.stockStatus === "INSTOCK" ? "Disponible" : form.stockStatus === "OUTOFSTOCK" ? "Agotado" : "Sobre pedido"
  return <div className="glass-preview" aria-label="Vista previa para el cliente">
    <div className="glass-preview-photo">{src ? <img src={src} alt="" /> : <ImageSquare size={22} aria-hidden="true" />}</div>
    <div className="min-w-0 flex-1"><p className="text-xs text-stone-500"><Eye size={12} aria-hidden="true" className="mr-1 inline" />Así lo ve el cliente</p>
      <p className="truncate font-semibold">{title || "Nombre del producto"}</p>
      {form.quoteOnly ? <p className="text-sm">Solicitar cotización</p> : form.hidePrice ? <p className="text-sm text-stone-500">Precio oculto</p> :
        <p className="flex flex-wrap items-baseline gap-2"><span className="text-lg font-semibold">{money(sale ?? regular)}</span>{sale != null && <><span className="text-sm text-stone-500 line-through">{money(regular)}</span>{off != null && off > 0 && <Badge tone="bad">−{off} %</Badge>}</>}</p>}
      <p className="text-xs text-stone-500">{stock}{percent > 0 ? ` · IVA ${percent} % incluido` : " · Exento de IVA"}</p>
    </div>
  </div>
}

export function ProductEditor({ productId, onClose, onSaved }: { productId: string | null; onClose: () => void; onSaved?: (p: Product) => void }) {
  const api = useCatalogPort()
  const { csrf, notify, changed } = useSession()
  // Sellers can look up a product (from an order or quote) but not change it.
  const readOnly = !useCan()("CATALOG_EDIT")
  const [product, setProduct] = useState<Product | null>(null)
  const [rates, setRates] = useState<TaxRate[]>([]), [categories, setCategories] = useState<Category[]>([])
  const [form, setForm] = useState<Form>(blank), [initial, setInitial] = useState<Form>(blank)
  const [cats, setCats] = useState<string[]>([]), [initialCats, setInitialCats] = useState<string[]>([])
  // how shoppers find it: its own keywords and age, plus what it takes from its categories
  const [keywords, setKeywords] = useState<string[]>([]), [age, setAge] = useState<AgeDraft>(noAge), [found, setFound] = useState<ProductSearchProfile | null>(null)
  const [page, setPage] = useState<PageDraft>(noPage), [initialPage, setInitialPage] = useState<PageDraft>(noPage)
  const [queued, setQueued] = useState<File[]>([])
  const [images, setImages] = useState<ProductImage[]>([])
  const [loadError, setLoadError] = useState(""), [loading, setLoading] = useState(true), [reload, setReload] = useState(0)
  const [tab, setTab] = useState<Tab>("general"), [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false), [error, setError] = useState("")
  const [slugTouched, setSlugTouched] = useState(!!productId)
  const [catQuery, setCatQuery] = useState("")
  const queuedPreview = useMemo(() => queued[0] ? URL.createObjectURL(queued[0]) : null, [queued])
  useEffect(() => () => { if (queuedPreview) URL.revokeObjectURL(queuedPreview) }, [queuedPreview])

  useEffect(() => {
    let active = true
    Promise.all([productId ? api.getProduct(productId) : Promise.resolve(null), api.listTaxRates(), api.listCategories(), productId ? api.listProductCategories(productId) : Promise.resolve([] as string[]), productId ? api.getProductSearch(productId) : Promise.resolve(null), productId ? api.getProductPage(productId) : Promise.resolve(emptyPage)])
      .then(([p, r, c, pc, sp, pg]) => {
        if (!active) return
        setRates(r); setCategories(c); setCats(pc); setInitialCats(pc); setProduct(p)
        const draft: PageDraft = { shortDescription: pg.shortDescription, descriptionHtml: pg.descriptionHtml, highlights: pg.highlights, specs: pg.specs, sections: pg.sections }
        setPage(draft); setInitialPage(draft)
        setFound(sp); setKeywords(sp?.keywords ?? []); setAge(sp ? ageDraft(sp) : noAge)
        const f = p ? fromProduct(p) : { ...blank, taxRateId: r.find(x => x.active && x.percent > 0)?.id ?? "" }
        setForm(f); setInitial(f); setLoading(false)
      }).catch(e => { if (active) { setLoadError(e instanceof Error ? e.message : "No se pudo cargar el producto"); setLoading(false) } })
    return () => { active = false }
  }, [api, productId, reload])

  const percent = rates.find(r => r.id === form.taxRateId)?.percent ?? 0
  const errors = useMemo(() => validate(form, initial.stockQuantity, age), [form, initial.stockQuantity, age])
  const findDirty = keywords.join("|") !== (found?.keywords ?? []).join("|") || age.ageMin !== (found ? ageDraft(found) : noAge).ageMin || age.ageMax !== (found ? ageDraft(found) : noAge).ageMax
  const toPage = (d: PageDraft) => d
  const pageDirty = JSON.stringify(page) !== JSON.stringify(initialPage)
  const pageProblem = pageDirty ? pageError(toPage(page)) : null
  const shown = submitted ? errors : {}
  const tabAlert = (t: Tab) => Object.keys(shown).some(k => TAB_OF[k] === t)
  const dirty = JSON.stringify(form) !== JSON.stringify(initial) || [...cats].sort().join() !== [...initialCats].sort().join() || findDirty || pageDirty || queued.length > 0
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm(f => ({ ...f, [k]: v }))
  const setTitle = (title: string) => setForm(f => ({ ...f, title, slug: slugTouched ? f.slug : slugify(title) }))
  const setRate = (id: string) => { const pct = rates.find(r => r.id === id)?.percent ?? 0; setForm(f => ({ ...f, taxRateId: id, regular: priceFrom(num(f.regular.base), pct), sale: priceFrom(num(f.sale.base), pct) })) }
  const stockDelta = form.manageStock && initial.manageStock && form.stockQuantity !== "" && initial.stockQuantity !== "" ? Number(form.stockQuantity) - Number(initial.stockQuantity) : null

  async function save(e: FormEvent) {
    e.preventDefault(); setSubmitted(true); setError("")
    const first = Object.keys(errors)[0]
    if (first) { setTab(TAB_OF[first] ?? "general"); return }
    if (pageProblem) { setTab("page"); return }
    setBusy(true)
    try {
      const saved = await api.saveProduct(productId, { title: form.title.trim(), slug: form.slug, status: form.status, sku: form.sku.trim() || null, taxRateId: form.taxRateId || null, regularPrice: num(form.regular.base),
        salePrice: form.onSale ? num(form.sale.base) : null, saleStartsAt: form.onSale ? startOf(form.saleStartsAt) : null, saleEndsAt: form.onSale ? startOf(form.saleEndsAt) : null,
        manageStock: form.manageStock, stockQuantity: form.manageStock ? num(form.stockQuantity) : null, stockStatus: form.stockStatus, backorders: form.backorders, quoteOnly: form.quoteOnly, hidePrice: form.hidePrice, featured: form.featured, stockReason: form.stockReason }, csrf)
      if ([...cats].sort().join() !== [...initialCats].sort().join()) await api.saveProductCategories(saved.id, cats, csrf)
      if (findDirty) await api.saveProductSearch(saved.id, toProfile(keywords, age), csrf)
      if (pageDirty) await api.saveProductPage(saved.id, cleanPage(toPage(page)), csrf)
      const failed: string[] = []
      for (const file of queued) { try { await api.uploadImage(saved.id, file, saved.title, csrf) } catch { failed.push(file.name) } }
      notify(failed.length ? `Producto guardado. No se pudieron subir: ${failed.join(", ")}.` : productId ? "Producto actualizado." : "Producto creado.")
      changed(); onSaved?.(saved); onClose()
    } catch (err) { setError(err instanceof Error ? err.message : "No se pudo guardar el producto") } finally { setBusy(false) }
  }

  const media = useMedia()
  const cover = images[0] ?? null
  const coverRef = productId ? (cover ? { productId, imageId: cover.id, imageUrl: cover.originalUrl, imageUploaded: cover.uploaded } : product ? { productId: product.id, imageId: product.imageId, imageUrl: product.imageUrl, imageUploaded: !product.imageUrl } : null) : null
  const coverSrc = coverRef ? media.src(coverRef) : queuedPreview
  const status = STATUS[form.status]
  const selectedCats = categories.filter(c => cats.includes(c.id))
  const visibleCats = categories.filter(c => !catQuery || c.name.toLowerCase().includes(catQuery.toLowerCase()))
  const footer = readOnly ? <div className="glass-dialog-actions"><span className="text-sm text-stone-500">Solo lectura: tu rol no permite editar productos.</span><button type="button" className="glass-chip" onClick={onClose}>Cerrar</button></div> : <div className="glass-dialog-actions">
    <span className="text-sm text-stone-500" aria-live="polite">{busy ? "Guardando…" : dirty ? "Tienes cambios sin guardar" : productId ? "Sin cambios" : ""}</span>
    <span className="flex gap-2"><button type="button" className="glass-chip" disabled={busy} onClick={onClose}>Cancelar</button><button type="submit" form="product-form" className="glass-cta" disabled={busy || loading || (!dirty && !!productId)}>{busy ? "Guardando…" : productId ? "Guardar cambios" : "Crear producto"}</button></span>
  </div>

  return <Dialog eyebrow={readOnly ? "Producto" : productId ? "Editar producto" : "Nuevo producto"} title={form.title || (productId ? "Producto" : "Producto sin nombre")} size="xl" busy={busy} onClose={onClose}
    confirmClose={dirty && !readOnly ? "Tienes cambios sin guardar en este producto." : null}
    media={<Thumb image={coverRef} size={52} />}
    meta={<><Badge tone={status.tone}>{status.label}</Badge>{form.sku && <span>SKU {form.sku}</span>}{product && product.unitsSold > 0 && <span>{plural(product.unitsSold, "unidad vendida", "unidades vendidas")}</span>}{form.featured && <Badge tone="info">Destacado</Badge>}</>}
    footer={footer}>
    {loadError ? <Failure message={loadError} onRetry={() => { setLoadError(""); setLoading(true); setReload(n => n + 1) }} /> : loading ? <Loading label="Cargando producto" rows={5} /> :
    <div className="glass-editor">
      <div className="glass-editor-media">
        {productId ? <ProductGallery productId={productId} productTitle={form.title} onChange={setImages} readOnly={readOnly} /> : <QueuedGallery files={queued} onAdd={f => setQueued(q => [...q, ...f])} onRemove={i => setQueued(q => q.filter((_, j) => j !== i))} />}
      </div>
      <form id="product-form" onSubmit={save} noValidate className="glass-editor-form">
        <Preview form={form} percent={percent} title={form.title} src={coverSrc} />
        {error && <p role="alert" className="glass-alert">{error}</p>}
        <Tabs label="Secciones del producto" value={tab} onChange={setTab} tabs={[
          { id: "general", label: "General", alert: tabAlert("general") }, { id: "price", label: "Precio", alert: tabAlert("price") },
          { id: "stock", label: "Inventario", alert: tabAlert("stock") }, { id: "categories", label: "Categorías", badge: cats.length || undefined },
          { id: "page", label: "Página", alert: submitted && !!pageProblem },
          { id: "search", label: "Búsqueda", badge: keywords.length || undefined, alert: tabAlert("search") }]} />
        <fieldset disabled={readOnly} className="contents">

        <TabPanel active={tab === "general"}><div className="grid gap-4">
          <label className="glass-label">Nombre<input className="glass-field" value={form.title} aria-invalid={!!shown.title} onChange={e => setTitle(e.target.value)} placeholder="Ej. Tablero Verde Mini Arco" autoFocus={!productId} />{shown.title && <span className="glass-field-error">{shown.title}</span>}</label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="glass-label">Dirección en la tienda<span className="glass-prefixed"><span aria-hidden="true">/producto/</span><input className="glass-field" value={form.slug} aria-invalid={!!shown.slug} onChange={e => { setSlugTouched(true); set("slug", e.target.value.toLowerCase()) }} /></span>{shown.slug && <span className="glass-field-error">{shown.slug}</span>}</label>
            <label className="glass-label">SKU<input className="glass-field" value={form.sku} onChange={e => set("sku", e.target.value)} placeholder="Código interno" /></label>
          </div>
          <div className="grid gap-2"><span className="text-sm font-semibold">Estado</span>
            <Segmented label="Estado" value={form.status} onChange={v => set("status", v)} options={[{ value: "PUBLISHED", label: "Publicado", icon: Eye }, { value: "DRAFT", label: "Borrador", icon: FileDashed }, { value: "ARCHIVED", label: "Archivado", icon: Archive }]} />
            <span className="text-xs text-stone-500">{form.status === "PUBLISHED" ? "Visible en la tienda." : form.status === "DRAFT" ? "Solo lo ves en el panel." : "Fuera de la tienda, se conserva su historial."}</span></div>
          <div className="grid gap-2">
            <Switch title="Producto destacado" hint="Aparece primero en las secciones de destacados." checked={form.featured} onChange={v => set("featured", v)} />
            <Switch title="Solo para cotización" hint="Muestra “Solicitar cotización” en lugar del botón de compra." checked={form.quoteOnly} onChange={v => set("quoteOnly", v)} />
            <Switch title="Ocultar el precio" hint="El cliente no ve el valor hasta pedir información." checked={form.hidePrice} onChange={v => set("hidePrice", v)} />
          </div>
        </div></TabPanel>

        <TabPanel active={tab === "price"}><div className="grid gap-4">
          <label className="glass-label">Impuesto<select className="glass-field" value={form.taxRateId} onChange={e => setRate(e.target.value)}><option value="">Sin tasa asignada</option>{rates.filter(r => r.active || r.id === form.taxRateId).map(r => <option key={r.id} value={r.id}>{r.name} ({r.percent} %)</option>)}</select></label>
          <PriceInputs label="Precio normal" value={form.regular} percent={percent} onChange={v => set("regular", v)} error={shown.price} />
          <Switch title="Poner en oferta" hint="Muestra el precio normal tachado y el porcentaje de descuento." checked={form.onSale} onChange={v => set("onSale", v)} />
          {form.onSale && <div className="glass-subpanel"><PriceInputs label="Precio de oferta" value={form.sale} percent={percent} onChange={v => set("sale", v)} error={shown.sale} />
            {num(form.sale.gross) != null && num(form.regular.gross) ? <p className="text-sm"><Sparkle size={14} aria-hidden="true" className="mr-1 inline" />Descuento de {Math.max(0, Math.round((1 - Number(form.sale.gross) / Number(form.regular.gross)) * 100))} % · el cliente ahorra {money(Number(form.regular.gross) - Number(form.sale.gross))}</p> : null}
            <div className="glass-dates"><label className="glass-label">Desde<input className="glass-field" type="date" value={form.saleStartsAt} onChange={e => set("saleStartsAt", e.target.value)} /></label><label className="glass-label">Hasta<input className="glass-field" type="date" min={form.saleStartsAt || undefined} value={form.saleEndsAt} aria-invalid={!!shown.saleEndsAt} onChange={e => set("saleEndsAt", e.target.value)} /></label></div>
            {shown.saleEndsAt ? <p className="glass-field-error">{shown.saleEndsAt}</p> : <p className="text-xs text-stone-500">Sin fechas, la oferta queda activa hasta que la desactives.</p>}</div>}
        </div></TabPanel>

        <TabPanel active={tab === "stock"}><div className="grid gap-4">
          <Switch title="Controlar existencias" hint="Cada venta descuenta unidades y avisa cuando quedan pocas." checked={form.manageStock} onChange={v => set("manageStock", v)} />
          {form.manageStock ? <>
            <div className="grid gap-2"><span className="text-sm font-semibold">Unidades disponibles</span><div className="flex flex-wrap items-center gap-4"><Stepper label="Unidades disponibles" value={form.stockQuantity} onChange={v => set("stockQuantity", v)} />
              {stockDelta != null && stockDelta !== 0 && <Badge tone={stockDelta > 0 ? "good" : "warn"}>{stockDelta > 0 ? "+" : ""}{count(stockDelta)} frente a lo guardado</Badge>}</div>{shown.stockQuantity && <p className="glass-field-error">{shown.stockQuantity}</p>}</div>
            {form.stockQuantity !== initial.stockQuantity && <div className="glass-subpanel"><label className="glass-label">Motivo del cambio<input className="glass-field" value={form.stockReason} aria-invalid={!!shown.stockReason} onChange={e => set("stockReason", e.target.value)} placeholder="Queda en el historial de inventario" /></label>
              <div className="glass-presets" role="group" aria-label="Motivos frecuentes">{REASONS.map(r => <button key={r} type="button" className="glass-preset" aria-pressed={form.stockReason === r} onClick={() => set("stockReason", r)}>{r}</button>)}</div>
              {shown.stockReason && <p className="glass-field-error">{shown.stockReason}</p>}</div>}
            <label className="glass-label">Cuando se agote<select className="glass-field" value={form.backorders} onChange={e => set("backorders", e.target.value as Backorders)}><option value="NO">Dejar de vender</option><option value="NOTIFY">Seguir vendiendo y avisar al cliente</option><option value="YES">Seguir vendiendo</option></select></label>
          </> : <div className="grid gap-2"><span className="text-sm font-semibold">Disponibilidad</span><Segmented label="Disponibilidad" value={form.stockStatus} onChange={v => set("stockStatus", v)} options={[{ value: "INSTOCK", label: "Disponible" }, { value: "ONBACKORDER", label: "Sobre pedido" }, { value: "OUTOFSTOCK", label: "Agotado" }]} /></div>}
        </div></TabPanel>

        <TabPanel active={tab === "categories"}><div className="grid gap-4">
          {selectedCats.length > 0 ? <ul className="glass-tag-list" aria-label="Categorías seleccionadas">{selectedCats.map(c => <li key={c.id}><Tag size={12} aria-hidden="true" />{c.name}<button type="button" aria-label={`Quitar ${c.name}`} onClick={() => setCats(l => l.filter(x => x !== c.id))}><X size={12} aria-hidden="true" /></button></li>)}</ul> : <p className="text-sm text-stone-500">Aún no está en ninguna categoría; así será difícil de encontrar.</p>}
          <label className="glass-search"><span className="sr-only">Buscar categoría</span><MagnifyingGlass size={18} aria-hidden="true" /><input type="search" className="glass-field" value={catQuery} onChange={e => setCatQuery(e.target.value)} placeholder={`Buscar entre ${categories.length} categorías`} /></label>
          <div className="glass-options" role="group" aria-label="Categorías disponibles">{visibleCats.length === 0 ? <p className="text-sm text-stone-500">Ninguna categoría coincide.</p> : visibleCats.map(c => <label className="glass-option" key={c.id}><input type="checkbox" checked={cats.includes(c.id)} onChange={e => setCats(l => e.target.checked ? [...l, c.id] : l.filter(id => id !== c.id))} />{c.name}{c.parentId && <span className="text-xs text-stone-500">· {categories.find(p => p.id === c.parentId)?.name}</span>}</label>)}</div>
        </div></TabPanel>

        <TabPanel active={tab === "page"}><PageFields value={page} onChange={setPage} error={submitted ? pageProblem ?? undefined : undefined} /></TabPanel>

        <TabPanel active={tab === "search"}><div className="grid gap-4">
          <p className="text-sm text-stone-500">Ayuda a que el buscador y el asistente encuentren este producto, aunque el cliente lo pida con otras palabras.</p>
          <KeywordInput value={keywords} onChange={setKeywords} hint="Otras formas de pedir este producto que no estén en su nombre. Por ejemplo: regalo de grado, día del niño." />
          {found && found.inheritedKeywords.length > 0 && <div className="glass-subpanel"><p className="text-sm font-semibold">Ya las tiene por sus categorías</p>
            <ul className="flex flex-wrap gap-2" aria-label="Palabras clave heredadas de las categorías">{found.inheritedKeywords.map(k => <li key={k}><Badge tone="neutral">{k}</Badge></li>)}</ul>
            <p className="text-xs text-stone-500">Se editan en Categorías y aplican a todos sus productos.</p></div>}
          <AgeRange value={age} onChange={setAge} hint={found && ageLabel(found.inheritedAgeMin, found.inheritedAgeMax) ? `Si la dejas vacía, toma la de sus categorías: ${ageLabel(found.inheritedAgeMin, found.inheritedAgeMax)}.` : "Con la edad, el asistente puede recomendarlo solo a quien le sirve."} />
        </div></TabPanel>
      </fieldset></form>
    </div>}
  </Dialog>
}

"use client"

import { useEffect, useRef, useState } from "react"
import { Plus, Package, Star } from "@phosphor-icons/react"
import type { Product, ProductStatus } from "../domain/catalog"
import { count, money, plural } from "../../shared/ui/format"
import { Badge, Chips, Empty, Failure, Loading, Search, useDebounced, useLoad, type Tone } from "../../shared/ui/parts"
import { Thumb } from "../../shared/ui/rich"
import { useCan, useSession } from "../../shared/ui/admin-context"
import { ProductEditor } from "./product-editor"
import { useCatalogPort } from "./use-catalog"

const STATUS: Record<ProductStatus, { label: string; tone: Tone }> = { PUBLISHED: { label: "Publicado", tone: "good" }, DRAFT: { label: "Borrador", tone: "warn" }, ARCHIVED: { label: "Archivado", tone: "neutral" } }
function stockLabel(p: Product): { text: string; tone: Tone } | null {
  if (p.quoteOnly) return { text: "Solo cotización", tone: "info" }
  if (!p.manageStock) return p.stockStatus === "OUTOFSTOCK" ? { text: "Agotado", tone: "bad" } : null
  const n = p.stockQuantity ?? 0
  return n <= 0 ? { text: "Sin existencias", tone: "bad" } : n <= 5 ? { text: `Quedan ${count(n)}`, tone: "warn" } : { text: `${count(n)} en existencia`, tone: "neutral" }
}

export function ProductsSection() {
  const api = useCatalogPort()
  const { version } = useSession()
  const canEdit = useCan()("CATALOG_EDIT")
  const [query, setQuery] = useState(""), [status, setStatus] = useState<ProductStatus | "">(""), [offset, setOffset] = useState(0)
  const [pageSize, setPageSize] = useState(6)
  const pageSizeRef = useRef(6)
  useEffect(() => {
    const update = () => {
      const size = Math.max(4, Math.min(10, Math.floor((window.innerHeight - 360) / 88)))
      if (pageSizeRef.current !== size) {
        pageSizeRef.current = size
        setOffset(0)
        setPageSize(size)
      }
    }
    update()
    window.addEventListener("resize", update)
    return () => window.removeEventListener("resize", update)
  }, [])
  const [editing, setEditing] = useState<string | null | undefined>(undefined)
  const q = useDebounced(query)
  const products = useLoad(() => api.listProducts(q, offset, status, pageSize), [q, offset, status, pageSize, version])
  const items = products.data ?? []

  return <div className="flex min-h-0 flex-1 flex-col">
    <section className="glass-card glass-catalog" aria-labelledby="products-title">
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-4"><span className="glass-icon-tile"><Package size={20} aria-hidden="true" /></span><h2 id="products-title" className="text-xl font-semibold">Catálogo</h2></div><p className="mt-4 hidden text-sm text-stone-500 sm:block">Precios con IVA, como los ve el cliente. Toca un producto para editarlo y gestionar sus fotos.</p></div>
        {canEdit && <button type="button" className="glass-cta" onClick={() => setEditing(null)}><Plus size={16} aria-hidden="true" />Crear producto</button>}</div>
      <div className="glass-filters mt-4 shrink-0">
        <Search value={query} onChange={v => { setOffset(0); setQuery(v) }} label="Buscar por nombre o SKU" />
        <Chips label="Estado" value={status} onChange={v => { setOffset(0); setStatus(v) }} options={[{ value: "", label: "Todos" }, ...(Object.keys(STATUS) as ProductStatus[]).map(s => ({ value: s, label: STATUS[s].label }))]} />
      </div>
      <div className="glass-pager mt-4 flex shrink-0 items-center justify-between gap-4"><span className="hidden text-xs text-stone-500 sm:block">Mostrando {items.length === 0 ? 0 : offset + 1} a {offset + items.length}</span><div className="flex gap-2"><button type="button" className="glass-chip" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - pageSize))}>Anterior</button><button type="button" className="glass-chip" disabled={items.length < pageSize} onClick={() => setOffset(offset + pageSize)}>Siguiente</button></div></div>
      {products.error ? <Failure message={products.error} onRetry={products.reload} /> : products.loading && !products.data ? <Loading label="Cargando productos" rows={6} /> : items.length === 0 ? <Empty icon={Package} title="No encontramos productos" hint="Prueba con otra búsqueda o crea uno nuevo." action={canEdit ? <button type="button" className="glass-chip" onClick={() => setEditing(null)}><Plus size={14} aria-hidden="true" />Crear producto</button> : undefined} /> :
        <ul aria-busy={products.loading} className={`glass-product-list ${products.loading ? "opacity-60" : ""}`} aria-label="Lista de productos">{items.map(p => { const stock = stockLabel(p); return <li key={p.id}>
          <button type="button" onClick={() => setEditing(p.id)} className="glass-product-row">
            <Thumb image={{ productId: p.id, imageId: p.imageId, imageUrl: p.imageUrl, imageUploaded: !p.imageUrl }} size={56} />
            <span className="min-w-0 flex-1"><span className="flex items-center gap-2"><span className="truncate text-sm font-semibold">{p.title}</span>{p.featured && <Star size={14} weight="fill" aria-label="Destacado" className="shrink-0 text-amber-300" />}</span>
              <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-stone-500"><span>{p.sku || "Sin SKU"}</span><Badge tone={STATUS[p.status].tone}>{STATUS[p.status].label}</Badge>{stock && <Badge tone={stock.tone}>{stock.text}</Badge>}{p.unitsSold > 0 && <span>{plural(p.unitsSold, "vendido", "vendidos")}</span>}</span></span>
            <span className="shrink-0 text-right text-sm font-semibold tabular-nums">{p.saleActive && p.salePriceWithTax != null ? <>{money(p.salePriceWithTax)}<span className="block text-xs font-normal text-stone-500 line-through">{money(p.regularPriceWithTax)}</span></> : <>{money(p.regularPriceWithTax)}{p.regularPrice != null && <span className="block text-xs font-normal text-stone-500">{money(p.regularPrice)} sin IVA</span>}</>}</span>
          </button></li> })}</ul>}

    </section>
    {editing !== undefined && <ProductEditor productId={editing} onClose={() => setEditing(undefined)} />}
  </div>
}

"use client"

import { useState, type FormEvent } from "react"
import { Plus, Tag } from "@phosphor-icons/react"
import type { Category } from "../domain/catalog"
import { Failure, Loading, useLoad } from "../../shared/ui/parts"
import { useCan, useSession } from "../../shared/ui/admin-context"
import { useCatalogPort } from "./use-catalog"

const blank = { id: "", name: "", slug: "", description: "", parentId: "" }
export function CategoriesSection() {
  const api = useCatalogPort()
  const { csrf, notify } = useSession()
  const canEdit = useCan()("CATALOG_EDIT")
  const categories = useLoad(() => api.listCategories(), [])
  const [category, setCategory] = useState(blank), [busy, setBusy] = useState(false), [error, setError] = useState("")
  async function save(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError("")
    try { await api.saveCategory({ ...category, parentId: category.parentId || null } as Category, csrf); notify("Categoría guardada correctamente."); setCategory(blank); categories.reload() } catch (err) { setError(err instanceof Error ? err.message : "No se pudo guardar la categoría; revisa el slug y la categoría padre.") } finally { setBusy(false) }
  }
  const list = categories.data ?? []
  return <div className="grid min-h-0 flex-1 items-start gap-6 overflow-y-auto xl:grid-cols-2">
    <section className="glass-card"><div className="flex items-center gap-4"><span className="glass-icon-tile"><Tag size={20} aria-hidden="true" /></span><div><h2 className="text-xl font-semibold">Categorías</h2><p className="mt-1 text-sm text-stone-500">{canEdit ? "Selecciona una categoría para editarla." : "Categorías de la tienda."}</p></div></div>
      {categories.error ? <Failure message={categories.error} onRetry={categories.reload} /> : categories.loading && !categories.data ? <Loading label="Cargando categorías" /> : list.length === 0 ? <p className="mt-6 text-sm text-stone-500">Aún no hay categorías.</p> : <ul className="mt-6 max-h-160 space-y-2 overflow-auto">{list.map(c => <li key={c.id}><button type="button" disabled={!canEdit} onClick={() => setCategory({ ...c, parentId: c.parentId || "" })} className={`glass-category-row${category.id === c.id ? " is-selected" : ""}`}><span>{c.name}</span><span className="text-xs font-normal text-stone-400">Editar →</span></button></li>)}</ul>}</section>
    {canEdit && <section className="glass-card"><div className="flex items-center gap-4"><span className="glass-icon-tile"><Plus size={20} aria-hidden="true" /></span><div><h2 className="text-xl font-semibold">{category.id ? "Editar categoría" : "Nueva categoría"}</h2><p className="mt-1 text-sm text-stone-500">Dale una estructura clara a tu catálogo.</p></div></div>{error && <p role="alert" className="glass-alert">{error}</p>}
      <form onSubmit={save} className="mt-8 grid gap-4"><label className="glass-label">Nombre<input className="glass-field" required value={category.name} onChange={e => setCategory({ ...category, name: e.target.value })} /></label><label className="glass-label">Slug<input className="glass-field" required value={category.slug} onChange={e => setCategory({ ...category, slug: e.target.value })} /></label><label className="glass-label">Descripción<input className="glass-field" value={category.description || ""} onChange={e => setCategory({ ...category, description: e.target.value })} /></label><label className="glass-label">Categoría padre<select className="glass-field" value={category.parentId} onChange={e => setCategory({ ...category, parentId: e.target.value })}><option value="">Sin categoría padre</option>{list.filter(c => c.id !== category.id).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><div className="flex flex-wrap gap-2 pt-2"><button className="glass-cta" disabled={busy}>Guardar categoría</button>{category.id && <button className="glass-chip" type="button" onClick={() => setCategory(blank)}>Cancelar</button>}</div></form></section>}
  </div>
}

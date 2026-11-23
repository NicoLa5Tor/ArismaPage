"use client"

import { useRef, useState, type FormEvent } from "react"
import { Plus, Tag } from "@phosphor-icons/react"
import type { Category } from "../domain/catalog"
import { type AgeDraft, ageDraft, ageError, toProfile } from "../domain/search-profile"
import { Failure, Loading, useLoad } from "../../shared/ui/parts"
import { useCan, useSession } from "../../shared/ui/admin-context"
import { AgeRange, KeywordInput } from "./search-fields"
import { useCatalogPort } from "./use-catalog"

const blank = { id: "", name: "", slug: "", description: "", parentId: "" }
const noAge: AgeDraft = { ageMin: "", ageMax: "" }
export function CategoriesSection() {
  const api = useCatalogPort()
  const { csrf, notify } = useSession()
  const canEdit = useCan()("CATALOG_EDIT")
  const categories = useLoad(() => api.listCategories(), [])
  const [category, setCategory] = useState(blank), [busy, setBusy] = useState(false), [error, setError] = useState("")
  // how shoppers find it: loaded when a category is picked, saved together with it
  const [keywords, setKeywords] = useState<string[]>([]), [age, setAge] = useState<AgeDraft>(noAge), [findLoading, setFindLoading] = useState(false)
  const picked = useRef("")
  /** Opens a category in the form (or a blank one) and brings its keywords and age. */
  function edit(next: typeof blank) {
    picked.current = next.id
    setCategory(next); setKeywords([]); setAge(noAge); setError(""); setFindLoading(!!next.id)
    if (!next.id) return
    // a slow answer for a category the admin already left must not overwrite the one on screen
    api.getCategorySearch(next.id).then(profile => { if (picked.current === next.id) { setKeywords(profile.keywords); setAge(ageDraft(profile)) } })
      .catch(err => { if (picked.current === next.id) setError(err instanceof Error ? err.message : "No se pudieron cargar las palabras clave de la categoría.") })
      .finally(() => { if (picked.current === next.id) setFindLoading(false) })
  }
  async function save(e: FormEvent) {
    e.preventDefault()
    if (ageError(age)) return
    setBusy(true); setError("")
    try {
      const saved = await api.saveCategory({ ...category, parentId: category.parentId || null } as Category, csrf)
      await api.saveCategorySearch(saved.id, toProfile(keywords, age), csrf)
      notify("Categoría guardada correctamente."); edit(blank); categories.reload()
    } catch (err) { setError(err instanceof Error ? err.message : "No se pudo guardar la categoría; revisa el slug y la categoría padre.") } finally { setBusy(false) }
  }
  const list = categories.data ?? []
  return <div className="grid min-h-0 flex-1 items-start gap-6 overflow-y-auto xl:grid-cols-2">
    <section className="glass-card"><div className="flex items-center gap-4"><span className="glass-icon-tile"><Tag size={20} aria-hidden="true" /></span><div><h2 className="text-xl font-semibold">Categorías</h2><p className="mt-1 text-sm text-stone-500">{canEdit ? "Selecciona una categoría para editarla." : "Categorías de la tienda."}</p></div></div>
      {categories.error ? <Failure message={categories.error} onRetry={categories.reload} /> : categories.loading && !categories.data ? <Loading label="Cargando categorías" /> : list.length === 0 ? <p className="mt-6 text-sm text-stone-500">Aún no hay categorías.</p> : <ul className="mt-6 max-h-160 space-y-2 overflow-auto">{list.map(c => <li key={c.id}><button type="button" disabled={!canEdit} onClick={() => edit({ ...c, parentId: c.parentId || "" })} className={`glass-category-row${category.id === c.id ? " is-selected" : ""}`}><span>{c.name}</span><span className="text-xs font-normal text-stone-400">Editar →</span></button></li>)}</ul>}</section>
    {canEdit && <section className="glass-card"><div className="flex items-center gap-4"><span className="glass-icon-tile"><Plus size={20} aria-hidden="true" /></span><div><h2 className="text-xl font-semibold">{category.id ? "Editar categoría" : "Nueva categoría"}</h2><p className="mt-1 text-sm text-stone-500">Dale una estructura clara a tu catálogo.</p></div></div>{error && <p role="alert" className="glass-alert">{error}</p>}
      <form onSubmit={save} className="mt-8 grid gap-4"><label className="glass-label">Nombre<input className="glass-field" required value={category.name} onChange={e => setCategory({ ...category, name: e.target.value })} /></label><label className="glass-label">Slug<input className="glass-field" required value={category.slug} onChange={e => setCategory({ ...category, slug: e.target.value })} /></label><label className="glass-label">Descripción<input className="glass-field" value={category.description || ""} onChange={e => setCategory({ ...category, description: e.target.value })} /></label><label className="glass-label">Categoría padre<select className="glass-field" value={category.parentId} onChange={e => setCategory({ ...category, parentId: e.target.value })}><option value="">Sin categoría padre</option>{list.filter(c => c.id !== category.id).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><div className="glass-subpanel"><div><h3 className="text-sm font-semibold">Para que la encuentren</h3><p className="mt-1 text-xs text-stone-500">Lo que pongas aquí lo heredan todos los productos de esta categoría y de sus subcategorías.</p></div>
        <KeywordInput value={keywords} onChange={setKeywords} disabled={findLoading} hint="Otras formas en que la gente pide esto. Por ejemplo, en Rompecabezas: puzzle, armar piezas." />
        <AgeRange value={age} onChange={setAge} disabled={findLoading} hint="Opcional. Sirve cuando toda la categoría es para una edad, como Bebés (0 a 2)." /></div>
      <div className="flex flex-wrap gap-2 pt-2"><button className="glass-cta" disabled={busy || findLoading}>{busy ? "Guardando…" : "Guardar categoría"}</button>{category.id && <button className="glass-chip" type="button" onClick={() => edit(blank)}>Cancelar</button>}</div></form></section>}
  </div>
}

"use client"

import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { ArrowRight, ArrowUpLeft, CircleNotch, ClockCounterClockwise, ImageSquare, MagnifyingGlass, Sparkle, TrendUp, X } from "@phosphor-icons/react"
import {
  type CatalogCategory, type SearchSuggestions, catalogHref, categoryMetaOf, formatCop, formatCount, matchCategories, popularSearches,
  productImageSrc, rootOf,
} from "../../domain/catalog"
import { CategoryIcon } from "../catalog/category-icons"
import { useAskLabel } from "../store-brand"
import { useCatalogCategories, useCatalogSearchPort } from "./use-catalog-categories"
import { optimized } from "../../../shared/ui/optimized-image"

const ease = [0.22, 1, 0.36, 1] as const
const RECENT_KEY = "arisma:busquedas"
const MAX_RECENT = 5

type Option = { id: string; run: () => void }
type Status = "idle" | "loading" | "done" | "error"

function readRecent(): string[] {
  try { const raw = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? "[]"); return Array.isArray(raw) ? raw.filter((item) => typeof item === "string").slice(0, MAX_RECENT) : [] } catch { return [] }
}
function writeRecent(list: string[]) {
  try { window.localStorage.setItem(RECENT_KEY, JSON.stringify(list)) } catch { /* private mode: recent searches just are not kept */ }
}

export type StoreSearchProps = {
  /** Catalog only: the box drives the product grid as the shopper types, so it shows no product suggestions of its own. */
  value?: string
  onValueChange?: (value: string) => void
  /** Catalog only: what Enter does; elsewhere Enter opens the catalog with the search. */
  onSubmit?: (query: string) => void
  /** Catalog only: choosing a category filters in place instead of navigating. */
  onCategory?: (slug: string) => void
  categories?: CatalogCategory[]
  /** Called once the box has taken the shopper somewhere, so an overlay around it can close. */
  onDone?: () => void
  autoFocus?: boolean
  shortcut?: boolean
}

/**
 * The store's search box, in every header. While typing it suggests products (photo, name, price) and categories; empty, it
 * offers recent and popular searches. Arrow keys move through the list, Enter opens the highlighted option or the catalog
 * with the words, Escape closes it, and "/" focuses it from anywhere on the page.
 */
export function StoreSearch({ value, onValueChange, onSubmit, onCategory, categories: given, onDone, autoFocus = false, shortcut = true }: StoreSearchProps) {
  const router = useRouter()
  const reduce = useReducedMotion()
  const askLabel = useAskLabel()
  const live = onValueChange !== undefined
  const [own, setOwn] = useState("")
  const text = live ? value ?? "" : own
  const setText = live ? onValueChange : setOwn
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [found, setFound] = useState<SearchSuggestions | null>(null)
  const [status, setStatus] = useState<Status>("idle")
  const [recent, setRecent] = useState<string[]>([])
  const [mounted, setMounted] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const listId = useId()
  const categories = useCatalogCategories(given)
  const port = useCatalogSearchPort()
  const query = text.trim()

  useEffect(() => { setMounted(true); setRecent(readRecent()) }, [])
  useEffect(() => { if (autoFocus) input.current?.focus() }, [autoFocus])

  // "/" puts the cursor in the search from anywhere, unless the shopper is already typing somewhere
  useEffect(() => {
    if (!shortcut) return
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return
      event.preventDefault()
      input.current?.focus()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [shortcut])

  // Product suggestions: one request after a short pause, the previous one cancelled
  useEffect(() => {
    if (live || !open || query.length < 2) { setFound(null); setStatus("idle"); return }
    const controller = new AbortController()
    setStatus("loading")
    const timer = window.setTimeout(() => {
      port.suggest(query, controller.signal)
        .then((result) => { setFound(result); setStatus("done") })
        .catch((error: unknown) => { if (!controller.signal.aborted) { setStatus("error"); console.warn("Sugerencias no disponibles", error) } })
    }, 200)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [live, open, port, query])

  const remember = useCallback((words: string) => {
    const clean = words.trim()
    if (!clean) return
    const next = [clean, ...readRecent().filter((item) => item.toLowerCase() !== clean.toLowerCase())].slice(0, MAX_RECENT)
    writeRecent(next); setRecent(next)
  }, [])

  const finish = useCallback(() => { setOpen(false); setActive(-1); input.current?.blur(); onDone?.() }, [onDone])

  const search = useCallback((words: string) => {
    const clean = words.trim()
    if (!clean) return
    remember(clean)
    if (live) setText(clean)
    if (onSubmit) onSubmit(clean)
    else router.push(catalogHref({ q: clean }))
    finish()
  }, [finish, live, onSubmit, remember, router, setText])

  const pickCategory = useCallback((slug: string) => {
    if (onCategory) onCategory(slug)
    else router.push(catalogHref({ category: slug }))
    finish()
  }, [finish, onCategory, router])

  const go = useCallback((href: string) => { router.push(href); finish() }, [finish, router])

  const forget = (words: string) => {
    const next = readRecent().filter((item) => item !== words)
    writeRecent(next); setRecent(next)
    input.current?.focus()
  }

  // In the catalog the categories are matched here, from the list the page already has; elsewhere they come with the products.
  const matched = useMemo(() => (live ? matchCategories(categories, query) : found?.categories ?? []), [categories, found, live, query])
  const products = useMemo(() => (live ? [] : found?.products ?? []), [found, live])

  // Everything the arrow keys can reach, in the order it is shown
  const options = useMemo<Option[]>(() => {
    if (!query) return [
      ...recent.map((words, index) => ({ id: `${listId}-r${index}`, run: () => search(words) })),
      ...popularSearches.map((words, index) => ({ id: `${listId}-p${index}`, run: () => search(words) })),
    ]
    return [
      ...products.map((product) => ({ id: `${listId}-${product.id}`, run: () => { remember(query); go(`/producto/${encodeURIComponent(product.slug)}`) } })),
      ...matched.map((category) => ({ id: `${listId}-${category.id}`, run: () => pickCategory(category.slug) })),
      { id: `${listId}-all`, run: () => search(query) },
      { id: `${listId}-ask`, run: () => go(`/buscar?q=${encodeURIComponent(query)}`) },
    ]
  }, [go, listId, matched, pickCategory, products, query, recent, remember, search])

  // In the catalog, typing already filters the grid below: the list only appears when it has something extra to offer.
  const hasPanel = open && (!query || !live || matched.length > 0)
  const activeId = hasPanel && active >= 0 ? options[active]?.id : undefined
  useEffect(() => { setActive(-1) }, [query])

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault()
      if (!open) { setOpen(true); return }
      const step = event.key === "ArrowDown" ? 1 : -1
      // -1 is the input itself: the highlight goes round options, input, options
      setActive((current) => {
        const next = current + step
        if (options.length === 0 || next >= options.length) return -1
        return next < -1 ? options.length - 1 : next
      })
      return
    }
    if (event.key === "Enter") {
      event.preventDefault()
      if (hasPanel && active >= 0 && options[active]) options[active].run()
      else search(query)
      return
    }
    if (event.key === "Escape") {
      if (open) { event.preventDefault(); setOpen(false); setActive(-1) }
      else if (text) { event.preventDefault(); setText("") }
    }
  }

  useEffect(() => {
    if (!activeId) return
    document.getElementById(activeId)?.scrollIntoView({ block: "nearest" })
  }, [activeId])

  const option = (key: string, position: number, children: ReactNode, className = "") => {
    const item = options[position]
    if (!item) return null
    return (
      <li key={key} id={item.id} role="option" aria-selected={active === position} className={`search-option ${className}`}
        onMouseDown={(event) => event.preventDefault()} onMouseEnter={() => setActive(position)} onClick={item.run}>
        {children}
      </li>
    )
  }

  const panel = (
    <motion.div className="search-panel squircle" initial={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2, ease }}>
      <ul id={listId} role="listbox" aria-label="Sugerencias de búsqueda" className="search-list">
        {!query ? (
          <>
            {recent.length > 0 && <li role="presentation" className="search-group">Búsquedas recientes</li>}
            {recent.map((words, at) => option(`r-${words}`, at, (
              <>
                <ClockCounterClockwise className="search-option-icon" size={18} aria-hidden="true" />
                <span className="search-option-text">{words}</span>
                <button type="button" className="search-forget" tabIndex={-1} aria-label={`Quitar «${words}» de las recientes`}
                  onClick={(event) => { event.stopPropagation(); forget(words) }}><X size={14} aria-hidden="true" /></button>
              </>
            )))}
            <li role="presentation" className="search-group">Lo más buscado</li>
            <li role="presentation" className="search-chips-row">
              <ul role="presentation" className="search-chips">
                {popularSearches.map((words, at) => option(`p-${words}`, recent.length + at, <><TrendUp size={14} aria-hidden="true" /> {words}</>, "search-chip squircle"))}
              </ul>
            </li>
          </>
        ) : (
          <>
            {status === "loading" && products.length === 0 && !live && (
              <li role="presentation" className="search-loading">{[0, 1, 2].map((key) => <span key={key} className="search-skeleton squircle" />)}</li>
            )}
            {products.length > 0 && <li role="presentation" className="search-group">Productos</li>}
            {products.map((product, at) => {
              const src = productImageSrc(product)
              const price = product.price !== null && !product.quoteOnly ? product.salePrice ?? product.price : null
              return option(product.id, at, (
                <>
                  <span className="search-thumb squircle">{src ? <img {...optimized(src, { sizes: "48px", width: 48 })} alt="" width={48} height={48} loading="lazy" decoding="async" /> : <ImageSquare size={20} aria-hidden="true" />}</span>
                  <span className="search-option-text">
                    <span className="search-option-title">{product.title}</span>
                    <span className="search-option-meta">{price !== null ? formatCop(price) : "Precio a cotizar"}{!product.inStock ? " · Agotado" : ""}</span>
                  </span>
                  <ArrowRight className="search-option-go" size={16} aria-hidden="true" />
                </>
              ), "is-product")
            })}
            {matched.length > 0 && <li role="presentation" className="search-group">Categorías</li>}
            {matched.map((category, at) => {
              const main = rootOf(categories, category.slug) ?? category
              return option(category.id, products.length + at, (
                <>
                  <span className="search-cat-icon squircle" data-tone={categoryMetaOf(main.slug).tone}><CategoryIcon slug={main.slug} size={18} weight="fill" aria-hidden="true" /></span>
                  <span className="search-option-text">
                    <span className="search-option-title">{category.name}</span>
                    <span className="search-option-meta">{category.parentId ? `En ${main.name} · ` : ""}{formatCount(category.productCount)} productos</span>
                  </span>
                  <ArrowUpLeft className="search-option-go" size={16} aria-hidden="true" />
                </>
              ))
            })}
            {status === "done" && products.length === 0 && matched.length === 0 && (
              <li role="presentation" className="search-empty">No encontramos productos con «{query}». Prueba con otra palabra o pregúntale a nuestro asistente.</li>
            )}
            {status === "error" && <li role="presentation" className="search-empty">No pudimos cargar sugerencias. Presiona Enter para buscar igual.</li>}
            {!live && found?.correctedQuery && <li role="presentation" className="search-corrected">Mostramos resultados de <strong>{found.correctedQuery}</strong></li>}
            {option("all", products.length + matched.length, (
              <>
                <MagnifyingGlass className="search-option-icon" size={18} aria-hidden="true" />
                <span className="search-option-text">{found && !live ? <>Ver los {formatCount(found.total)} resultados de «{query}»</> : <>Ver resultados de «{query}»</>}</span>
                <kbd className="search-kbd">Enter</kbd>
              </>
            ), "is-all")}
            {option("ask", products.length + matched.length + 1, (
              <>
                <Sparkle className="search-option-icon is-ask" size={18} weight="fill" aria-hidden="true" />
                <span className="search-option-text">¿No lo encuentras? <strong>{askLabel}</strong></span>
              </>
            ), "is-ask")}
          </>
        )}
      </ul>
    </motion.div>
  )

  return (
    <div ref={box} className="store-search" data-open={hasPanel}
      onFocus={() => setOpen(true)}
      onBlur={(event) => { if (!box.current?.contains(event.relatedTarget as Node | null)) { setOpen(false); setActive(-1) } }}>
      <div className="search-field squircle">
        {status === "loading" ? <CircleNotch className="spin search-field-icon" size={20} aria-hidden="true" /> : <MagnifyingGlass className="search-field-icon" size={20} aria-hidden="true" />}
        <label className="sr-only" htmlFor={`${listId}-input`}>Buscar productos</label>
        <input ref={input} id={`${listId}-input`} type="search" role="combobox" autoComplete="off" spellCheck={false} enterKeyHint="search" maxLength={80}
          aria-expanded={hasPanel} aria-controls={listId} aria-autocomplete="list" aria-activedescendant={activeId}
          value={text} placeholder="Busca títeres, rompecabezas, robótica…"
          onChange={(event) => { setText(event.target.value); setOpen(true) }} onKeyDown={onKeyDown} />
        {text ? (
          <button type="button" className="search-clear" onClick={() => { setText(""); input.current?.focus() }} aria-label="Borrar búsqueda"><X size={16} aria-hidden="true" /></button>
        ) : shortcut ? <kbd className="search-kbd search-shortcut" aria-hidden="true">/</kbd> : null}
      </div>
      <AnimatePresence>{hasPanel && panel}</AnimatePresence>
      {mounted && createPortal(
        <AnimatePresence>
          {hasPanel && <motion.div className="search-scrim" aria-hidden="true" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} onMouseDown={() => input.current?.blur()} />}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  )
}

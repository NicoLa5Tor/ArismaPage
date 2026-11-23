"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react"
import { usePathname, useRouter } from "next/navigation"
import { AnimatePresence } from "motion/react"
import { ArrowClockwise, ArrowDown, ChalkboardTeacher, CircleNotch, FadersHorizontal, Receipt, Truck, WhatsappLogo } from "@phosphor-icons/react"
import {
  type CatalogCategory, type CatalogFilters, type CatalogPage, MAX_PAGES, catalogSorts, filtersToQuery, formatCount,
  formatCop, mainCategories, rootOf,
} from "../../domain/catalog"
import { type ActiveFilter, ActiveFilters } from "./active-filters"
import { CatalogHeading } from "./catalog-heading"
import { CategorySidebar } from "./category-sidebar"
import { CategoryTabs } from "./category-tabs"
import { FiltersSheet } from "./filters-sheet"
import { ProductCard, ProductCardSkeleton } from "./product-card"
import { useStoreProfile, useWhatsapp } from "../../../shared/ui/store-profile"
import { localArea } from "../../../shared/domain/store-profile"
import { StoreBar } from "../store-bar"

const cleared = { q: "", category: "", offers: false, priced: false, sort: "destacados" as const, exact: false }

export function CatalogView({ categories, page, filters, catalogTotal, failed }: { categories: CatalogCategory[]; page: CatalogPage | null; filters: CatalogFilters; catalogTotal: number; failed: boolean }) {
  const whatsappUrl = useWhatsapp()
  const profile = useStoreProfile()
  const router = useRouter()
  const pathname = usePathname()
  const [pending, startTransition] = useTransition()
  // "Cargar más" is in flight while a navigation towards more pages than shown is pending.
  const [requestedPages, setRequestedPages] = useState(filters.pages)
  const [text, setText] = useState(filters.q)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [exploring, setExploring] = useState(false)
  const results = useRef<HTMLDivElement>(null)

  const mains = useMemo(() => mainCategories(categories), [categories])
  const root = filters.category ? rootOf(categories, filters.category) : null
  const active = categories.find((category) => category.slug === filters.category) ?? null

  const go = useCallback((next: Partial<CatalogFilters>, toResults = false) => {
    // a new search is corrected again; only "Buscar así" asks for the words as written
    const merged = { ...filters, pages: 1, exact: false, ...next }
    startTransition(() => router.push(`${pathname}${filtersToQuery(merged)}`, { scroll: false }))
    if (toResults) results.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [filters, pathname, router])

  // Search as the shopper types, without a request per keystroke.
  const latest = useRef(filters.q)
  useEffect(() => {
    if (text.trim() === latest.current) return
    const timer = window.setTimeout(() => { latest.current = text.trim(); go({ q: text.trim() }) }, 300)
    return () => window.clearTimeout(timer)
  }, [text, go])

  // A category chosen from the explorer or the search box starts a fresh browse: the words typed before no longer apply.
  const browseCategory = (slug: string) => {
    latest.current = ""; setText("")
    go({ category: slug, q: "" })
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const clearAll = () => { latest.current = ""; setText(""); go(cleared) }
  const chosen: ActiveFilter[] = [
    ...(filters.q ? [{ key: "q", label: `“${filters.q}”`, onRemove: () => { latest.current = ""; setText(""); go({ q: "" }) } }] : []),
    ...(active ? [{ key: "cat", label: active.name, onRemove: () => go({ category: active.parentId ? root?.slug ?? "" : "" }) }] : []),
    ...(filters.offers ? [{ key: "offers", label: "Ofertas", onRemove: () => go({ offers: false }) }] : []),
    ...(filters.priced ? [{ key: "priced", label: "Con precio", onRemove: () => go({ priced: false }) }] : []),
  ]

  const items = page?.items ?? []
  const hasMore = page ? items.length < page.total && filters.pages < MAX_PAGES : false
  const loadingMore = pending && requestedPages > filters.pages
  const showSkeleton = pending && !loadingMore
  const resultLabel = page ? `Ver ${formatCount(page.total)} ${page.total === 1 ? "producto" : "productos"}` : "Ver productos"

  const sidebar = (
    <CategorySidebar categories={categories} mains={mains} root={root} filters={filters}
      onCategory={(slug) => go({ category: slug })} onToggle={(key) => go(key === "offers" ? { offers: !filters.offers } : { priced: !filters.priced })} />
  )

  return (
    <main id="contenido" className="storefront catalog">
      <StoreBar categories={categories} current={filters.category} onCategory={browseCategory} contactHref="#contacto"
        explorer={{ open: exploring, setOpen: setExploring }}
        search={{ value: text, onValueChange: setText, onSubmit: (words) => { latest.current = words; go({ q: words }, true) } }} />

      <div className="catalog-top">
        <CatalogHeading categories={categories} current={filters.category} total={catalogTotal} onSelect={browseCategory} onExplore={() => setExploring(true)} />
      </div>

      <CategoryTabs categories={categories} mains={mains} root={root} current={filters.category} onSelect={(slug) => go({ category: slug })} onExplore={() => setExploring(true)} />

      <div className="catalog-body" ref={results}>
        <aside className="catalog-aside" aria-label="Categorías y filtros">{sidebar}</aside>

        <section id="productos" className="catalog-results" aria-label="Productos" aria-busy={pending}>
          <div className="results-bar">
            <p className="results-count" aria-live="polite">
              {pending ? <><CircleNotch className="spin" size={16} aria-hidden="true" /> Buscando…</> : page ? <><strong>{formatCount(page.total)}</strong> {page.total === 1 ? "producto" : "productos"}</> : null}
            </p>
            <div className="results-actions">
              <button type="button" className="filters-button squircle" onClick={() => setSheetOpen(true)}>
                <FadersHorizontal size={18} aria-hidden="true" /> Filtros{chosen.length > 0 ? <span className="filters-badge">{chosen.length}</span> : null}
              </button>
              <label className="sort squircle">
                <span className="sort-label">Ordenar</span>
                <select value={filters.sort} onChange={(event) => go({ sort: event.target.value as CatalogFilters["sort"] })}>
                  {catalogSorts.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
            </div>
          </div>
          <ActiveFilters items={chosen} onClearAll={clearAll} />
          {!pending && page?.correctedQuery && filters.q ? (
            <p className="results-corrected" aria-live="polite">
              Mostramos resultados de <strong>{page.correctedQuery}</strong>.{" "}
              <button type="button" onClick={() => go({ q: filters.q, exact: true })}>Buscar «{filters.q}» tal como lo escribiste</button>
            </p>
          ) : null}

          {failed ? (
            <div className="catalog-state squircle">
              <h2>No pudimos cargar el catálogo</h2>
              <p>Revisa tu conexión e inténtalo de nuevo. Si sigue fallando, escríbenos y te ayudamos por WhatsApp.</p>
              <button type="button" className="button-primary" onClick={() => startTransition(() => router.refresh())}><ArrowClockwise size={18} aria-hidden="true" /> Reintentar</button>
            </div>
          ) : showSkeleton ? (
            <div className="product-grid">{Array.from({ length: 6 }, (_, index) => <ProductCardSkeleton key={index} />)}</div>
          ) : items.length === 0 ? (
            <div className="catalog-state squircle">
              <h2>No encontramos productos con esos filtros</h2>
              <p>Prueba con otra palabra o quita algún filtro. También puedes pedirnos lo que buscas por WhatsApp.</p>
              <div className="catalog-state-actions">
                <button type="button" className="button-primary" onClick={clearAll}>Ver todo el catálogo</button>
                <a className="button-secondary squircle" href={whatsappUrl(`Hola, busco: ${filters.q || active?.name || "un producto"}`)} target="_blank" rel="noopener noreferrer">Preguntar por WhatsApp</a>
              </div>
            </div>
          ) : (
            <>
              <div className="product-grid">
                <AnimatePresence initial={false}>
                  {items.map((product, index) => <ProductCard key={product.id} product={product} index={index} />)}
                </AnimatePresence>
              </div>
              {hasMore && (
                <div className="load-more">
                  <button type="button" className="button-secondary squircle" disabled={pending} onClick={() => { setRequestedPages(filters.pages + 1); startTransition(() => router.push(`${pathname}${filtersToQuery({ ...filters, pages: filters.pages + 1 })}`, { scroll: false })) }}>
                    {loadingMore ? <><CircleNotch className="spin" size={18} aria-hidden="true" /> Cargando…</> : <><ArrowDown size={18} aria-hidden="true" /> Cargar más productos</>}
                  </button>
                  <p>Viendo {formatCount(items.length)} de {formatCount(page!.total)}</p>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      <FiltersSheet open={sheetOpen} onClose={() => setSheetOpen(false)} resultLabel={pending ? "Buscando…" : resultLabel}>{sidebar}</FiltersSheet>

      <section className="trust-strip" aria-label={`Por qué comprar en ${profile.shortName}`}>
        <Trust icon={WhatsappLogo} title="Cotización por WhatsApp" text="Te respondemos con precio, disponibilidad y tiempos de entrega." />
        {profile.shipping.freeFromLocal != null
          ? <Trust icon={Truck} title={`Envío gratis en ${localArea(profile)}`} text={`En compras desde ${formatCop(profile.shipping.freeFromLocal)}. Enviamos a toda Colombia.`} />
          : <Trust icon={Truck} title="Envíos a toda Colombia" text="Te despachamos con transportadora y te damos el número de guía." />}
        <Trust icon={ChalkboardTeacher} title="Colegios y ludotecas" text="Armamos dotaciones completas y te asesoramos por edad y área." />
        <Trust icon={Receipt} title="Precios con IVA incluido" text={`El precio que ves es el que pagas.${profile.shipping.minimumOrder > 0 ? ` Compra mínima de ${formatCop(profile.shipping.minimumOrder)}.` : ""}`} />
      </section>

      <section id="contacto" className="final-cta" aria-labelledby="contacto-titulo">
        <h2 id="contacto-titulo">¿No encuentras lo que buscas?</h2>
        <p>Cuéntanos la edad de los niños y lo que quieres trabajar. Te ayudamos a elegir{catalogTotal > 0 ? <> entre {formatCount(catalogTotal)} productos</> : null}.</p>
        <a className="button-primary" href={whatsappUrl("Hola, necesito ayuda para elegir un producto")} target="_blank" rel="noopener noreferrer"><WhatsappLogo size={20} weight="fill" aria-hidden="true" /> Hablar con un asesor</a>
      </section>

      <footer className="storefront-footer">
        <p>© {new Date().getFullYear()} {profile.legalName || profile.name}{profile.pickupLine ? `. ${profile.pickupLine}.` : "."}</p>
        <Link href="/admin">Administración</Link>
      </footer>
    </main>
  )
}

function Trust({ icon: Icon, title, text }: { icon: typeof WhatsappLogo; title: string; text: string }) {
  return (
    <div className="trust squircle">
      <Icon size={28} weight="duotone" aria-hidden="true" />
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  )
}

// Public store catalog: what shoppers see of the published products, plus the pure rules around it.

export type CatalogProduct = {
  id: string
  title: string
  slug: string
  /** Tax-inclusive regular price; null when the store hides it. */
  price: number | null
  /** Tax-inclusive sale price, only while the sale is running. */
  salePrice: number | null
  quoteOnly: boolean
  inStock: boolean
  featured: boolean
  imageId: string | null
  imageUrl: string | null
  imageUploaded: boolean
}

export type CatalogCategory = { id: string; name: string; slug: string; parentId: string | null; productCount: number }

/** `correctedQuery`: what was searched when the shopper's words had spelling mistakes (null when searched as written). */
export type CatalogPage = { items: CatalogProduct[]; total: number; page: number; pageSize: number; correctedQuery?: string | null }

/** What the home page shows off: the most ordered published products and the size of the catalog. */
export type CatalogHighlights = { bestSellers: CatalogProduct[]; productCount: number }

export const catalogSorts = [
  { value: "destacados", label: "Destacados" },
  { value: "novedades", label: "Novedades" },
  { value: "precio-asc", label: "Precio: menor a mayor" },
  { value: "precio-desc", label: "Precio: mayor a menor" },
] as const
export type CatalogSort = (typeof catalogSorts)[number]["value"]

/**
 * Filters as they live in the URL of /productos; `pages` is how many pages of results are shown ("Cargar más") and
 * `exact` searches the words as written, without spelling correction.
 */
export type CatalogFilters = { q: string; category: string; sort: CatalogSort; offers: boolean; priced: boolean; pages: number; exact: boolean }

export const MAX_PAGES = 20

type Params = Record<string, string | string[] | undefined>
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? ""

export function parseFilters(params: Params): CatalogFilters {
  const sort = first(params.orden)
  const pages = Number.parseInt(first(params.pagina), 10)
  return {
    q: first(params.q).trim().slice(0, 80),
    category: first(params.categoria).trim(),
    sort: catalogSorts.some((option) => option.value === sort) ? (sort as CatalogSort) : "destacados",
    offers: first(params.ofertas) === "1",
    priced: first(params.precio) === "1",
    pages: Number.isFinite(pages) ? Math.min(Math.max(pages, 1), MAX_PAGES) : 1,
    exact: first(params.exacto) === "1",
  }
}

/** URL query for the given filters; defaults are left out so links stay short and shareable. */
export function filtersToQuery(filters: CatalogFilters): string {
  const query = new URLSearchParams()
  if (filters.q) query.set("q", filters.q)
  if (filters.category) query.set("categoria", filters.category)
  if (filters.sort !== "destacados") query.set("orden", filters.sort)
  if (filters.offers) query.set("ofertas", "1")
  if (filters.priced) query.set("precio", "1")
  if (filters.pages > 1) query.set("pagina", String(filters.pages))
  if (filters.exact && filters.q) query.set("exacto", "1")
  const text = query.toString()
  return text ? `?${text}` : ""
}

export const hasActiveFilters = (filters: CatalogFilters) => Boolean(filters.q || filters.category || filters.offers || filters.priced || filters.sort !== "destacados")

const cop = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 })
export const formatCop = (value: number) => cop.format(value)
export const formatCount = (value: number) => new Intl.NumberFormat("es-CO").format(value)

/** Percentage saved on a running sale, rounded down so the badge never overstates it. */
export function discountPercent(product: CatalogProduct): number | null {
  if (product.price === null || product.salePrice === null || product.salePrice >= product.price) return null
  return Math.floor((1 - product.salePrice / product.price) * 100)
}

/** The first message of a WhatsApp quote for a product. The store's number comes from its profile (useWhatsapp). */
export const quoteMessage = (product: Pick<CatalogProduct, "title">) => (`Hola, quiero cotizar: ${product.title}`)

/** Cover photo: historical photos keep their original URL; uploaded ones go through the public image route. */
export function productImageSrc(product: CatalogProduct): string | null {
  if (product.imageUrl && !product.imageUploaded) return product.imageUrl
  if (product.imageId) return `/api/arisma-public/products/${encodeURIComponent(product.id)}/images/${encodeURIComponent(product.imageId)}`
  return product.imageUrl
}

/** Top-level categories that have products, largest first. "Uncategorized" (the WooCommerce default) is never shown. */
export function mainCategories(categories: CatalogCategory[]): CatalogCategory[] {
  return categories.filter((category) => !category.parentId && category.productCount > 0 && category.slug !== "uncategorized").sort((a, b) => b.productCount - a.productCount)
}

export function childCategories(categories: CatalogCategory[], parentId: string): CatalogCategory[] {
  return categories.filter((category) => category.parentId === parentId && category.productCount > 0).sort((a, b) => b.productCount - a.productCount)
}

/** The main category a slug belongs to (itself when it is a main one), so its subcategories can be offered. */
export function rootOf(categories: CatalogCategory[], slug: string): CatalogCategory | null {
  let current = categories.find((category) => category.slug === slug) ?? null
  while (current?.parentId) {
    const parentId: string = current.parentId
    current = categories.find((category) => category.id === parentId) ?? null
  }
  return current
}

/** Colours of the Arisma Didácticos logo; each main category wears one, like a label on a toy box. */
export type BrandTone = "pink" | "blue" | "orange" | "green"

export type CategoryMeta = { image: string; blurb: string; tone: BrandTone }

const categoryMeta: Record<string, CategoryMeta> = {
  didacticos: { image: "/catalog/categorias/didacticos.jpg", blurb: "Encajables, tangram, rompecabezas y juegos para aprender letras y números.", tone: "pink" },
  "educando-para-la-vida": { image: "/catalog/categorias/educando-para-la-vida.jpg", blurb: "Ábacos, ajedrez y cuentos para pensar, contar y compartir en familia.", tone: "blue" },
  "aulas-de-clase": { image: "/catalog/categorias/aulas-de-clase.jpg", blurb: "Dotación para el salón: motricidad, mobiliario blando, globos y material de apoyo.", tone: "orange" },
  "por-edades": { image: "/catalog/categorias/por-edades.jpg", blurb: "Juguetes pensados para cada etapa, desde la cuna hasta los primeros juegos de equilibrio.", tone: "green" },
  "juguetes-geniales": { image: "/catalog/categorias/juguetes-geniales.jpg", blurb: "Drones, construcción y juguetes para jugar en grande.", tone: "pink" },
  "ciencias-y-tecnologia": { image: "/catalog/categorias/ciencias-y-tecnologia.jpg", blurb: "Microscopios, modelos anatómicos, plumas 3D y kits para experimentar.", tone: "blue" },
  "variedades-y-decoracion": { image: "/catalog/categorias/variedades-y-decoracion.jpg", blurb: "Relojes y piezas decorativas para el cuarto y el escritorio.", tone: "orange" },
  "nuevos-juegos": { image: "/catalog/categorias/nuevos-juegos.jpg", blurb: "Lo último que llegó a la tienda: juegos de mesa, flash cards y más.", tone: "green" },
}

const fallbackTones: BrandTone[] = ["pink", "blue", "orange", "green"]

/** Image, short description and colour of a main category; unknown categories get a rotating tone and no image. */
export function categoryMetaOf(slug: string, index = 0): CategoryMeta | { image: null; blurb: null; tone: BrandTone } {
  return categoryMeta[slug] ?? { image: null, blurb: null, tone: fallbackTones[index % fallbackTones.length] }
}

/** Lower case without accents, so "titere" finds "Títeres". */
export const foldText = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()

/** What the search box offers while the shopper types: a few products and the categories whose name matches. */
export type SearchSuggestions = { products: CatalogProduct[]; total: number; categories: CatalogCategory[]; correctedQuery: string | null }

/** Categories with products whose name contains every typed word, main ones first, at most `limit`. */
export function matchCategories(categories: CatalogCategory[], query: string, limit = 3): CatalogCategory[] {
  const words = foldText(query).split(/\s+/).filter((word) => word.length > 1)
  if (words.length === 0) return []
  return categories
    .filter((category) => category.productCount > 0 && category.slug !== "uncategorized" && words.every((word) => foldText(category.name).includes(word)))
    .sort((a, b) => Number(Boolean(a.parentId)) - Number(Boolean(b.parentId)) || b.productCount - a.productCount)
    .slice(0, limit)
}

/** The path from the main category down to `slug`, for breadcrumbs. */
export function categoryTrail(categories: CatalogCategory[], slug: string): CatalogCategory[] {
  const trail: CatalogCategory[] = []
  let current = categories.find((category) => category.slug === slug) ?? null
  while (current) {
    trail.unshift(current)
    const parentId = current.parentId
    current = parentId ? categories.find((category) => category.id === parentId) ?? null : null
  }
  return trail
}

/** Link to the catalog filtered by a search or a category. */
export const catalogHref = (next: { q?: string; category?: string }) => `/productos${filtersToQuery({ ...parseFilters({}), q: next.q ?? "", category: next.category ?? "" })}`

/** Short searches people make often in this store, offered before typing. */
export const popularSearches = ["Títeres", "Rompecabezas", "Robótica", "Ábaco", "Microscopio", "Tangram"]

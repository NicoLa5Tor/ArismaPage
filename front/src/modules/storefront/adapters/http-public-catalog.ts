import type { PublicCatalogPort } from "../application/public-catalog-port"
import type { CatalogCategory, CatalogHighlights, CatalogPage } from "../domain/catalog"
import type { ProductDetail } from "../domain/product"

// Server-side only: talks straight to the backend's public API, never to a browser-chosen host.
const base = () => process.env.ARISMA_ADMIN_API_URL || "http://127.0.0.1:9001"

async function get<T>(path: string, revalidate: number): Promise<T> {
  const response = await fetch(new URL(`/api/public/catalog${path}`, base()), { next: { revalidate } })
  if (!response.ok) throw new Error(`Catálogo no disponible (${response.status})`)
  return response.json() as Promise<T>
}

export const httpPublicCatalog: PublicCatalogPort = {
  categories: () => get<CatalogCategory[]>("/categories", 300),
  highlights: () => get<CatalogHighlights>("/highlights", 300),
  async product(slug) {
    const response = await fetch(new URL(`/api/public/catalog/products/${encodeURIComponent(slug)}`, base()), { next: { revalidate: 60 } })
    if (response.status === 404) return null
    if (!response.ok) throw new Error(`Producto no disponible (${response.status})`)
    return response.json() as Promise<ProductDetail>
  },
  async products(filters) {
    const query = (page: number) => {
      const params = new URLSearchParams({ pagina: String(page), orden: filters.sort })
      if (filters.q) params.set("q", filters.q)
      if (filters.category) params.set("categoria", filters.category)
      if (filters.offers) params.set("ofertas", "true")
      if (filters.priced) params.set("conPrecio", "true")
      if (filters.exact) params.set("exacto", "true")
      return `/products?${params}`
    }
    const pages = await Promise.all(Array.from({ length: filters.pages }, (_, index) => get<CatalogPage>(query(index + 1), 60)))
    const last = pages[pages.length - 1]
    return { items: pages.flatMap((page) => page.items), total: last.total, page: last.page, pageSize: last.pageSize, correctedQuery: last.correctedQuery ?? null }
  },
}

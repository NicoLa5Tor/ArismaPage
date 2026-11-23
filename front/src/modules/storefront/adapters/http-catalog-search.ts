import type { CatalogSearchPort } from "../application/catalog-search-port"
import { type CatalogCategory, type CatalogPage, matchCategories } from "../domain/catalog"

// Browser side: goes through this site's read-only /api/arisma-public window onto the catalog, never to the backend directly.
let categoriesRequest: Promise<CatalogCategory[]> | null = null

function loadCategories(): Promise<CatalogCategory[]> {
  categoriesRequest ??= fetch("/api/arisma-public/categories")
    .then((response) => { if (!response.ok) throw new Error("Categorías no disponibles"); return response.json() as Promise<CatalogCategory[]> })
    .catch((error) => { categoriesRequest = null; throw error })
  return categoriesRequest
}

export const httpCatalogSearch: CatalogSearchPort = {
  categories: loadCategories,
  async suggest(query, signal) {
    const params = new URLSearchParams({ q: query, pagina: "1", orden: "destacados" })
    const [page, categories] = await Promise.all([
      fetch(`/api/arisma-public/products?${params}`, { signal }).then((response) => {
        if (!response.ok) throw new Error("Búsqueda no disponible")
        return response.json() as Promise<CatalogPage>
      }),
      loadCategories().catch(() => [] as CatalogCategory[]),
    ])
    return { products: page.items.slice(0, 5), total: page.total, categories: matchCategories(categories, query), correctedQuery: page.correctedQuery ?? null }
  },
}

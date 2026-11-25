import type { Metadata } from "next"
import { httpStoreProfile } from "../../../modules/shared/adapters/http-store-profile"
import { robotsFor } from "../../../modules/shared/domain/store-profile"
import { httpPublicCatalog } from "../../../modules/storefront/adapters/http-public-catalog"
import { type CatalogCategory, type CatalogPage, parseFilters } from "../../../modules/storefront/domain/catalog"
import { CatalogView } from "../../../modules/storefront/ui/catalog/catalog-view"

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Juguetes educativos y material didáctico",
    description: "Catálogo de juguetes educativos, robótica, juegos de mesa, títeres y material para aulas de clase. Envíos a toda Colombia y cotización por WhatsApp.",
    robots: robotsFor(await httpStoreProfile.load(), { index: true, follow: true }),
    alternates: { canonical: "/productos" },
  }
}

// The catalog is rendered on the server from the URL, so every filtered view is a real, shareable and indexable page.
export default async function ProductsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const filters = parseFilters(await searchParams)
  const filtered = Boolean(filters.q || filters.category || filters.offers || filters.priced)
  let categories: CatalogCategory[] = []
  let page: CatalogPage | null = null
  let catalogTotal = 0
  let failed = false
  try {
    // Products belong to several categories, so the whole-catalog count comes from an unfiltered query, not a sum.
    const [found, current, all] = await Promise.all([
      httpPublicCatalog.categories(),
      httpPublicCatalog.products(filters),
      filtered ? httpPublicCatalog.products(parseFilters({})) : null,
    ])
    categories = found
    page = current
    catalogTotal = (all ?? current).total
  } catch {
    failed = true
  }
  return <CatalogView categories={categories} page={page} filters={filters} catalogTotal={catalogTotal} failed={failed} />
}

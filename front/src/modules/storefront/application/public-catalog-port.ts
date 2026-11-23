import type { CatalogCategory, CatalogFilters, CatalogHighlights, CatalogPage } from "../domain/catalog"
import type { ProductDetail } from "../domain/product"

/** Read-only access to the published catalog. */
export interface PublicCatalogPort {
  categories(): Promise<CatalogCategory[]>
  /** Every result from page 1 up to `filters.pages`, as one page. */
  products(filters: CatalogFilters): Promise<CatalogPage>
  /** Best sellers and catalog size, for the home page. */
  highlights(): Promise<CatalogHighlights>
  /** The page of one published product; null when the slug is unknown or the product is not published. */
  product(slug: string): Promise<ProductDetail | null>
}

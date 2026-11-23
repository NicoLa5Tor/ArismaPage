import type { CatalogCategory, SearchSuggestions } from "../domain/catalog"

/** Browser side search over the published catalog, for the search box in every header. */
export interface CatalogSearchPort {
  /** A few products and the matching categories for what the shopper is typing. */
  suggest(query: string, signal?: AbortSignal): Promise<SearchSuggestions>
  /** Every category with its count, read once per visit. */
  categories(): Promise<CatalogCategory[]>
}

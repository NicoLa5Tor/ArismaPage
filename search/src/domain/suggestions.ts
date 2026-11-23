// Follow-up chips: short refinements of the search in progress, sent with one tap. The conversation context makes
// "Más económicos" or "Para 4 a 7 años" apply to what is on screen. Category names and age bands come from the live catalog.
import type { IndexedProduct } from "./product.js"
import { payablePrice } from "./product.js"
import type { Intent } from "./query.js"
import { type Taxonomy, statedBands } from "./taxonomy.js"

export function suggestionsFor(intent: Intent, results: IndexedProduct[], taxonomy: Taxonomy, hasMore = false): string[] {
  const out: string[] = []
  if (!intent.cheap && !intent.maxPrice && results.some((p) => payablePrice(p) !== null)) out.push("Más económicos")
  if (!intent.offers && results.some((p) => p.salePrice !== null)) out.push("En oferta")

  // the age band most represented among the results, when the shopper did not give an age
  if (!intent.age) {
    const band = mostCommon(results, new Set(taxonomy.ageBands.map((b) => b.slug)))
    const name = band && taxonomy.bySlug.get(band)?.name
    if (name) out.push(`Para ${name.toLowerCase()}`)
  }
  // the most represented top-level category, when the shopper did not name one
  if (!intent.category) {
    const root = mostCommon(results, new Set(taxonomy.main.map((c) => c.slug)))
    const name = root && taxonomy.bySlug.get(root)?.name
    if (name) out.push(`Solo en ${name}`)
  }
  const chips = out.slice(0, 3)
  return hasMore ? [...chips, "Muéstrame más"] : chips
}

function mostCommon(results: IndexedProduct[], allowed: Set<string>): string | null {
  const counts = new Map<string, number>()
  for (const p of results) for (const slug of p.categorySlugs) if (allowed.has(slug)) counts.set(slug, (counts.get(slug) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
}

/** First chips on an empty chat, built from the categories that exist today plus the store's own examples. */
export function starterSuggestions(taxonomy: Taxonomy, extras: string[] = [], budget: string | null = null): string[] {
  const out: string[] = []
  const [first, second, third] = [...taxonomy.main].sort((a, b) => b.productCount - a.productCount)
  const bands = statedBands(taxonomy)
  const band = bands.find((b) => b.min >= 3 && b.min <= 6) ?? bands[0]
  const bandName = band && taxonomy.bySlug.get(band.slug)?.name
  if (first && bandName) out.push(`${first.name} para ${bandName.toLowerCase()}`)
  if (second) out.push(`Lo más destacado de ${second.name}`)
  if (third && budget) out.push(`${third.name} por menos de ${budget}`)
  return [...out, ...extras].slice(0, 4)
}

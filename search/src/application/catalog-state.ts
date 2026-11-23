import { EMPTY_TAXONOMY, type Taxonomy, buildTaxonomy, type Category, contradicts, rootSlugOf, statedBands } from "../domain/taxonomy.js"
import type { Embedder } from "./ports.js"

/**
 * What the service currently knows about the store's structure: the category tree and, for each category,
 * a vector of what it is about. Refreshed on every sync, so new categories work without code changes.
 */
export class CatalogState {
  taxonomy: Taxonomy = EMPTY_TAXONOMY
  private vectors: { slug: string; vector: number[] }[] = []

  async refresh(categories: Category[], embedder: Embedder): Promise<void> {
    const taxonomy = buildTaxonomy(categories)
    const ages = new Set(statedBands(taxonomy).map((b) => b.slug))
    // describe each category by its own name, the names of its children ("Ciencias y tecnología: Matemáticas, Ingeniería…")
    // and the words shoppers use for it, so "algo de robots" can land on Robótica educativa
    const described = [...taxonomy.bySlug.values()].filter((c) => c.productCount > 0 && !ages.has(c.slug)).map((c) => {
      const children = [...taxonomy.bySlug.values()].filter((k) => k.parentSlug === c.slug && k.productCount > 0).map((k) => k.name)
      const also = c.keywords?.length ? `. También se busca como: ${c.keywords.join(", ")}` : ""
      return { slug: c.slug, text: `passage: ${c.name}${children.length ? `: ${children.join(", ")}` : ""}${also}` }
    })
    const vectors = described.length ? await embedder.passages(described.map((d) => d.text)) : []
    this.vectors = described.map((d, i) => ({ slug: d.slug, vector: vectors[i]! }))
    this.taxonomy = taxonomy
  }

  /** Category closest in meaning to the question, only when it clearly stands out from the rest. */
  closestCategory(query: number[], text: string): { slug: string; root: string } | null {
    // a category the words contradict ("Motricidad fina" for "motricidad gruesa") is never the answer, however close it sounds
    const scored = this.vectors
      .filter(({ slug }) => !contradicts(text, this.taxonomy.bySlug.get(slug)?.name ?? ""))
      .map(({ slug, vector }) => ({ slug, score: dot(query, vector) })).sort((a, b) => b.score - a.score)
    const [best, next] = scored
    if (!best || best.score < SEMANTIC_MIN || (next && best.score - next.score < SEMANTIC_MARGIN)) return null
    return { slug: best.slug, root: rootSlugOf(this.taxonomy, best.slug) ?? best.slug }
  }
}

/** e5 cosine similarities for clearly related short texts sit around 0.85+; the margin keeps ambiguous questions unboosted. */
const SEMANTIC_MIN = 0.84
const SEMANTIC_MARGIN = 0.012
const dot = (a: number[], b: number[]) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i]! * b[i]!; return s }

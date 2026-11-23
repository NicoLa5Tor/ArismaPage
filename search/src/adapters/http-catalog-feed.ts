import { z } from "zod"
import type { CatalogFeed } from "../application/ports.js"

// Shape of GET /api/public/catalog/feed (Quarkus). Parsed strictly: anything unexpected is rejected, not indexed.
const productSchema = z.object({
  id: z.string().uuid(), title: z.string(), slug: z.string(),
  price: z.number().nullable(), salePrice: z.number().nullable(),
  quoteOnly: z.boolean(), inStock: z.boolean(), featured: z.boolean(),
  imageId: z.string().uuid().nullable(), imageUrl: z.string().nullable(), imageUploaded: z.boolean(),
})
const age = z.number().int().min(0).max(99).nullish()
const span = (min: number | null | undefined, max: number | null | undefined) => (typeof min === "number" && typeof max === "number" && min <= max ? { min, max } : null)
const pageSchema = z.object({
  // keywords and ages are optional: a catalog that does not have them still feeds the index
  items: z.array(z.object({ product: productSchema, description: z.string(), categories: z.array(z.string()), categorySlugs: z.array(z.string()), keywords: z.array(z.string()).default([]), ageMin: age, ageMax: age, updatedAt: z.string() })),
  removed: z.array(z.string().uuid()),
  page: z.number(),
  hasMore: z.boolean(),
})

const categoriesSchema = z.array(z.object({ id: z.string().uuid(), name: z.string(), slug: z.string(), parentId: z.string().uuid().nullable(), productCount: z.number(), keywords: z.array(z.string()).default([]), ageMin: age, ageMax: age }))

/** Reads the store's public, read-only feed. The search service holds no database credentials. */
export class HttpCatalogFeed implements CatalogFeed {
  constructor(private readonly baseUrl: string, private readonly timeoutMs = 20_000) {}

  async categories() {
    const response = await fetch(new URL("/api/public/catalog/categories", this.baseUrl), { signal: AbortSignal.timeout(this.timeoutMs) })
    if (!response.ok) throw new Error(`El catálogo respondió ${response.status}`)
    const list = categoriesSchema.parse(await response.json())
    const slugOf = new Map(list.map((c) => [c.id, c.slug]))
    return list.map((c) => ({ slug: c.slug, name: c.name, parentSlug: c.parentId ? slugOf.get(c.parentId) ?? null : null, productCount: c.productCount, keywords: c.keywords, age: span(c.ageMin, c.ageMax) }))
  }

  async changes(since: Date | null) {
    const products = []
    const removed: string[] = []
    for (let page = 1; page <= 100; page++) {
      const url = new URL("/api/public/catalog/feed", this.baseUrl)
      url.searchParams.set("pagina", String(page))
      if (since) url.searchParams.set("desde", since.toISOString())
      const response = await fetch(url, { signal: AbortSignal.timeout(this.timeoutMs) })
      if (!response.ok) throw new Error(`El catálogo respondió ${response.status}`)
      const data = pageSchema.parse(await response.json())
      for (const item of data.items) products.push({ ...item.product, description: item.description, categories: item.categories, categorySlugs: item.categorySlugs, keywords: item.keywords, age: span(item.ageMin, item.ageMax), updatedAt: item.updatedAt })
      removed.push(...data.removed)
      if (!data.hasMore) break
    }
    return { products, removed }
  }
}

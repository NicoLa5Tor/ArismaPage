import { create, count, load, removeMultiple, save, search, upsertMultiple, type AnyOrama, type RawData } from "@orama/orama"
import type { Candidate, SearchIndex } from "../application/ports.js"
import type { IndexedProduct } from "../domain/product.js"
import { distance, forms, rootOf, soundKey, words } from "../domain/taxonomy.js"
import { MODEL_DIM } from "./model-config.js"

const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")

/** In-memory hybrid index (~10 MB for the whole catalog). Text fields are stored accent-free so "titere" finds "Títere". */
export class OramaIndex implements SearchIndex {
  private db: AnyOrama
  private products = new Map<string, IndexedProduct>()
  /** Every word used in a title; rebuilt lazily after the catalog changes. */
  private titleWords: Set<string> | null = null
  /** Every word of three letters or more used in titles, categories and descriptions. */
  private vocabulary: Set<string> | null = null
  private keywordSet: Set<string> | null = null
  private nameCache = new Map<string, Set<string>>()
  /** For each word root, the catalog word that uses it most ("sum" → "suma"). */
  private roots = new Map<string, string>()
  /** For each way a word sounds, the catalog word that uses it most ("jirafa" for "girafa"). */
  private sounds = new Map<string, string>()
  /** How each catalog word sounds, worked out once per vocabulary. */
  private soundOf = new Map<string, string>()
  /** How many times the catalog uses each word. */
  private uses = new Map<string, number>()

  constructor() {
    this.db = create({
      schema: { title: "string", categories: "string", keywords: "string", description: "string", embedding: `vector[${MODEL_DIM}]` } as const,
    })
  }

  async upsert(items: { product: IndexedProduct; embedding: number[] }[]): Promise<void> {
    if (!items.length) return
    await upsertMultiple(this.db, items.map(({ product, embedding }) => ({
      id: product.id,
      title: fold(product.title),
      categories: fold(product.categories.join(" ")),
      keywords: fold(product.keywords.join(" ")),
      description: fold(product.description),
      embedding,
    })))
    for (const { product } of items) this.products.set(product.id, product)
    this.titleWords = null
    this.vocabulary = null
    this.keywordSet = null
    this.nameCache = new Map()
  }

  async remove(ids: string[]): Promise<void> {
    const present = ids.filter((id) => this.products.has(id))
    if (!present.length) return
    await removeMultiple(this.db, present)
    for (const id of present) this.products.delete(id)
    this.titleWords = null
    this.vocabulary = null
    this.keywordSet = null
    this.nameCache = new Map()
  }

  knows(word: string): { word: string; typo: boolean } | null {
    if (!this.vocabulary) {
      const counts = new Map<string, number>()
      for (const p of this.products.values()) for (const w of fold(`${p.title} ${p.categories.join(" ")} ${p.keywords.join(" ")} ${p.description}`).split(/[^a-z0-9]+/)) if (w.length >= 3) counts.set(w, (counts.get(w) ?? 0) + 1)
      this.vocabulary = new Set(counts.keys())
      this.uses = counts
      this.roots = new Map()
      this.sounds = new Map()
      this.soundOf = new Map()
      // least used first, so the most used word ends up owning each root; a sound goes to a product name before a
      // word that is only in descriptions
      const byUse = [...counts].sort((a, b) => a[1] - b[1])
      for (const [w] of byUse) {
        if (w.length < 4 || /^\d+$/.test(w)) continue
        this.roots.set(rootOf(w), w)
        this.soundOf.set(w, soundKey(w))
      }
      for (const [w] of [...byUse.filter(([w]) => !this.sells(w)), ...byUse.filter(([w]) => this.sells(w))]) {
        const sound = this.soundOf.get(w)
        if (sound) this.sounds.set(sound, w)
      }
    }
    const known = this.vocabulary
    if (forms(word).some((form) => known.has(form))) return { word, typo: false }
    // another form of a catalog word ("sumar" for "suma", "dinosaurio" for "dinosaurios"): use the catalog's
    const sameRoot = word.length >= 4 ? this.roots.get(rootOf(word)) : undefined
    if (sameRoot) return { word: sameRoot, typo: false }
    if (word.length < 4) return null
    // written as it sounds ("girafa", "yaves", "cavallo"): the catalog's spelling of that sound
    const sound = soundKey(word)
    const sameSound = this.sounds.get(sound)
    if (sameSound) return { word: sameSound, typo: true }
    // typo tolerance only for longer words: a short one is a letter away from too many others. Compared by sound, so
    // a slip and a spelling by ear in the same word still meet ("ronpecabesas")
    if (word.length < 6) return null
    const allowed = word.length >= 10 ? 2 : 1
    // between equally close words, a product name beats a word of the descriptions ("tieres": "titeres", not "tienes"),
    // and then the more used one
    const weight = (w: string) => (this.sells(w) ? 1_000_000 : 0) + (this.uses.get(w) ?? 0)
    let best: { word: string; typos: number; weight: number } | null = null
    for (const [candidate, candidateSound] of this.soundOf) {
      if (candidate.length < 6) continue
      const typos = distance(sound, candidateSound, allowed)
      if (typos > allowed || (best && typos > best.typos)) continue
      const w = weight(candidate)
      if (!best || typos < best.typos || w > best.weight) best = { word: candidate, typos, weight: w }
    }
    return best ? { word: best.word, typo: true } : null
  }

  hasKeyword(phrase: string): boolean {
    this.keywordSet ??= new Set([...this.products.values()].flatMap((p) => p.keywords.map(fold)))
    return this.keywordSet.has(phrase)
  }

  async nearest(vector: number[]): Promise<number> {
    const result = await search(this.db, { mode: "vector", vector: { value: vector, property: "embedding" }, similarity: 0, limit: 1 })
    return result.hits[0]?.score ?? 0
  }

  named(asked: string[]): IndexedProduct[] {
    if (!asked.length) return []
    return [...this.products.values()].filter((product) => { const name = this.nameWords(product); return asked.every((word) => forms(word).some((form) => name.has(form))) })
  }

  /** The accent-free words of a product's name, kept until the catalog changes. */
  nameWords(product: IndexedProduct): Set<string> {
    let cached = this.nameCache.get(product.id)
    if (!cached) { cached = new Set(fold(product.title).split(/[^a-z0-9]+/).filter(Boolean)); this.nameCache.set(product.id, cached) }
    return cached
  }

  sells(word: string): boolean {
    const known = this.titleWords ??= new Set([...this.products.values()].flatMap((product) => words(`${product.title} ${product.keywords.join(" ")}`)))
    return forms(word).some((form) => known.has(form))
  }

  size(): number { return count(this.db) as number }

  get(ids: string[]): IndexedProduct[] { return ids.flatMap((id) => this.products.get(id) ?? []) }

  snapshot(): unknown {
    return { orama: save(this.db), products: [...this.products.values()] }
  }

  adopt(other: SearchIndex): void {
    if (!(other instanceof OramaIndex)) throw new Error("Solo se puede adoptar otro OramaIndex")
    this.db = other.db
    this.products = other.products
    this.titleWords = null
    this.vocabulary = null
    this.keywordSet = null
    this.nameCache = new Map()
  }

  restore(snapshot: unknown): void {
    const data = snapshot as { orama: RawData; products: IndexedProduct[] }
    load(this.db, data.orama)
    this.products.clear()
    // an index saved before keywords and ages existed still answers while it is rebuilt
    for (const product of data.products) this.products.set(product.id, { ...product, keywords: product.keywords ?? [], age: product.age ?? null })
    this.titleWords = null
    this.vocabulary = null
    this.keywordSet = null
    this.nameCache = new Map()
  }

  async search(text: string, vector: number[], limit: number): Promise<Candidate[]> {
    const vectorPart = { value: vector, property: "embedding" }
    const result = text.trim()
      ? await search(this.db, {
          mode: "hybrid", term: text, vector: vectorPart, similarity: 0.75, limit,
          properties: ["title", "categories", "keywords", "description"], boost: { title: 3, keywords: 2.5, categories: 1.5 }, tolerance: 1,
          hybridWeights: { text: 0.55, vector: 0.45 },
        })
      : await search(this.db, { mode: "vector", vector: vectorPart, similarity: 0.75, limit })
    return result.hits.flatMap((hit) => {
      const product = this.products.get(hit.id)
      return product ? [{ product, score: hit.score }] : []
    })
  }
}

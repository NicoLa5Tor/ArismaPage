import type { IndexedProduct } from "../domain/product.js"
import type { Category } from "../domain/taxonomy.js"

/** Where products come from: the store's public, read-only catalog feed. */
export interface CatalogFeed {
  /** Published products changed after `since` (all when null), plus ids that stopped being published. */
  changes(since: Date | null): Promise<{ products: (IndexedProduct & { updatedAt: string })[]; removed: string[] }>
  /** The whole category tree with published-product counts. */
  categories(): Promise<Category[]>
}

/** Turns text into a normalised vector; queries and passages are encoded differently (e5 convention). */
export interface Embedder {
  query(text: string): Promise<number[]>
  passages(texts: string[]): Promise<number[][]>
}

export type Candidate = { product: IndexedProduct; score: number }

export interface SearchIndex {
  upsert(items: { product: IndexedProduct; embedding: number[] }[]): Promise<void>
  remove(ids: string[]): Promise<void>
  size(): number
  /** The indexed products with these ids, in the order given; unknown ids are skipped. */
  get(ids: string[]): IndexedProduct[]
  /** Whether this accent-free phrase is, word for word, a keyword the store gave to some product. */
  hasKeyword(phrase: string): boolean
  /** How close in meaning the nearest product is to this vector (cosine, 0 when the index is empty). */
  nearest(vector: number[]): Promise<number>
  /** Products whose name carries every one of these accent-free words (singular or plural). */
  named(words: string[]): IndexedProduct[]
  /** Whether some product title or keyword carries this word (accent-free, singular or plural). */
  sells(word: string): boolean
  /**
   * The catalog word this one is (titles, categories, descriptions): itself when used as written or in plural, the
   * word it is a typo of ("ronpecabesas" → "rompecabezas"), or null when the catalog knows nothing like it.
   */
  knows(word: string): { word: string; typo: boolean } | null
  /** Hybrid (words with typo tolerance + meaning) when there is text, meaning only otherwise. */
  search(text: string, vector: number[], limit: number): Promise<Candidate[]>
  /** Takes over everything another index holds, at once: a rebuild is prepared aside and swapped in. */
  adopt(other: SearchIndex): void
  /** Serializable copy of the whole index, and the way back. */
  snapshot(): unknown
  restore(snapshot: unknown): void
}

/**
 * `modelKey` says which model made the vectors (they are useless with another one); `indexKey` also covers what was
 * indexed and how the text was written, so a change there rebuilds while the old index keeps answering.
 */
export type SavedIndex = { cursor: string; modelKey: string; indexKey?: string; index: unknown }

/** Keeps the index on disk so a restart is ready in seconds instead of re-embedding the whole catalog. */
export interface SnapshotStore {
  read(): Promise<SavedIndex | null>
  write(snapshot: SavedIndex): Promise<void>
}

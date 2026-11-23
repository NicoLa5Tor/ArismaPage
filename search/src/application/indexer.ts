import { passageOf } from "../domain/product.js"
import type { CatalogState } from "./catalog-state.js"
import type { CatalogFeed, Embedder, SearchIndex, SnapshotStore } from "./ports.js"

const BATCH = 16
/**
 * While the index is answering, products are embedded a few at a time: the model serves one request at a time, and a
 * shopper's question waits behind whatever batch is running. Four take about 0,7 s on a laptop CPU, well under the
 * 1,5 s the site waits before falling back to the plain search.
 */
const LIVE_BATCH = 4

/** What a saved index is good for: "current" as it is, "stale" to answer while a rebuild runs, "none" not at all. */
export type Restored = "current" | "stale" | "none"

/**
 * Keeps the in-memory index in step with the public catalog: full load first, then only what changed. A full
 * rebuild over an index that already answers is prepared aside and swapped in when done, so search never goes dark.
 */
export class Indexer {
  private cursor: Date | null = null
  private running = false

  constructor(private readonly feed: CatalogFeed, private readonly embedder: Embedder, private readonly index: SearchIndex, private readonly catalog: CatalogState,
              private readonly snapshots: SnapshotStore, private readonly keys: { model: string; index: string; compatible?: string[] },
              private readonly fresh: () => SearchIndex, private readonly log: (msg: string) => void) {}

  async restore(): Promise<Restored> {
    try {
      const saved = await this.snapshots.read()
      if (!saved) return "none"
      const current = saved.indexKey === this.keys.index
      // vectors from the same model still answer well while the text they were made from is being rewritten
      const usable = current || saved.modelKey === this.keys.model || (this.keys.compatible ?? []).includes(saved.modelKey)
      if (!usable) return "none"
      this.index.restore(saved.index)
      this.cursor = current ? new Date(saved.cursor) : null
      return this.index.size() === 0 ? "none" : current ? "current" : "stale"
    } catch (error) {
      this.log(`No se pudo cargar el índice guardado (${(error as Error).message}); se reconstruye`)
      return "none"
    }
  }

  /** Returns how many products were (re)indexed and removed. Never runs twice at the same time. */
  async sync(full = false): Promise<{ indexed: number; removed: number }> {
    if (this.running) return { indexed: 0, removed: 0 }
    this.running = true
    try {
      const since = full ? null : this.cursor
      const started = new Date()
      // categories first: new or renamed ones are understood from this sync on, and their paths go into the passages
      await this.catalog.refresh(await this.feed.categories(), this.embedder)
      const { products, removed } = await this.feed.changes(since)
      // a full load over a working index goes into a new one; products that left the catalog simply are not in it
      const aside = full && this.index.size() > 0
      const target = aside ? this.fresh() : this.index
      const size = this.index.size() > 0 ? LIVE_BATCH : BATCH
      for (let i = 0; i < products.length; i += size) {
        const batch = products.slice(i, i + size)
        const vectors = await this.embedder.passages(batch.map((product) => passageOf(product, this.catalog.taxonomy)))
        await target.upsert(batch.map((product, k) => ({ product, embedding: vectors[k]! })))
        // let a waiting question in before the next batch
        await new Promise((resolve) => setImmediate(resolve))
      }
      // an empty answer from the catalog never wipes an index that works
      if (aside && target.size() > 0) this.index.adopt(target)
      else if (removed.length) await this.index.remove(removed)
      // next round asks for changes made after this one started (a little overlap is harmless: upserts are idempotent)
      this.cursor = new Date(started.getTime() - 60_000)
      if (products.length || removed.length || full) await this.snapshots.write({ cursor: this.cursor.toISOString(), modelKey: this.keys.model, indexKey: this.keys.index, index: this.index.snapshot() })
      if (products.length || removed.length) this.log(`Índice: ${products.length} ${aside ? "reconstruidos" : "actualizados"}, ${removed.length} retirados, ${this.index.size()} en total`)
      return { indexed: products.length, removed: removed.length }
    } finally {
      this.running = false
    }
  }
}

// Composition root: wires the hexagon and starts the internal search API.
import { HttpCatalogFeed } from "./adapters/http-catalog-feed.js"
import { E5Embedder } from "./adapters/e5-embedder.js"
import { buildServer } from "./adapters/fastify-server.js"
import { loadProfile } from "./adapters/file-profile.js"
import { OramaIndex } from "./adapters/orama-index.js"
import { FileSnapshotStore } from "./adapters/file-snapshot-store.js"
import { LOCK_FILE } from "./adapters/model-config.js"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { CatalogState } from "./application/catalog-state.js"
import { DialogueState } from "./application/dialogue-state.js"
import { Indexer } from "./application/indexer.js"
import { SearchService } from "./application/search-service.js"
import { buildTopics } from "./domain/dialogue.js"

const host = process.env.SEARCH_HOST ?? "127.0.0.1"
const port = Number(process.env.SEARCH_PORT ?? 9002)
const catalogUrl = process.env.CATALOG_URL ?? "http://127.0.0.1:9001"
const reindexToken = process.env.SEARCH_TOKEN && process.env.SEARCH_TOKEN.length >= 24 ? process.env.SEARCH_TOKEN : null
const log = (msg: string) => console.log(`[arisma-search] ${msg}`)

if (!["127.0.0.1", "::1", "localhost"].includes(host)) log(`Escuchando en ${host}: asegúrate de que sea una red privada, nunca expuesta a internet.`)

// everything store-specific comes from this file; a wrong profile stops the start
const profile = loadProfile(process.env.STORE_PROFILE ?? "arisma")
log(`Perfil de tienda: ${profile.name}`)

const embedder = await E5Embedder.load()
const index = new OramaIndex()
const catalog = new CatalogState()
// vectors are only valid for the model that produced them (modelKey); raise INDEX_VERSION whenever the indexed fields
// or the text given to the model change, and the index is rebuilt once while the previous one keeps answering
const INDEX_VERSION = "4-plain-passages"
const lock = readFileSync(LOCK_FILE)
const keyOf = (...parts: (Buffer | string)[]) => parts.reduce((hash, part) => hash.update(part), createHash("sha256")).digest("hex")
// before modelKey and indexKey were separate, the saved key was model and version together
const keys = { model: keyOf(lock), index: keyOf(lock, INDEX_VERSION), compatible: [keyOf(lock, "2-keywords")] }
// each store keeps its own index: SEARCH_DATA is the file (Arisma keeps data/index.json)
const snapshots = new FileSnapshotStore(process.env.SEARCH_DATA || fileURLToPath(new URL("../data/index.json", import.meta.url)))
const indexer = new Indexer(new HttpCatalogFeed(catalogUrl), embedder, index, catalog, snapshots, keys, () => new OramaIndex(), log)
const dialogue = new DialogueState(buildTopics(profile))
await dialogue.load(embedder)
const search = new SearchService(index, embedder, catalog, dialogue, profile)
let ready = false

const app = buildServer({ search, indexer, catalog, ready: () => ready, reindexToken })
await app.listen({ host, port })
log(`API interna en http://${host}:${port}${reindexToken ? "" : " (reindexado manual desactivado: define SEARCH_TOKEN de 24+ caracteres)"}`)

// Saved index first (ready in seconds, then only what changed); otherwise a full load. Retries until the catalog is reachable.
const t0 = performance.now()
const restored = await indexer.restore()
if (restored !== "none") log(`Índice guardado cargado: ${index.size()} productos${restored === "stale" ? " (versión anterior: responde mientras se reconstruye)" : ""}`)
// with something to answer from, the service is ready now; a stale index is rebuilt behind it
if (restored !== "none") ready = true
for (;;) {
  try { await indexer.sync(restored !== "current"); break } catch (error) {
    if (restored !== "none") { log(`Catálogo no disponible (${(error as Error).message}); se usa el índice guardado`); break }
    log(`No se pudo leer el catálogo (${(error as Error).message}); reintento en 15 s`); await new Promise((r) => setTimeout(r, 15_000))
  }
}
ready = true
log(`Listo: ${index.size()} productos indexados en ${((performance.now() - t0) / 1000).toFixed(1)} s`)

const every = (ms: number, full: boolean) => setInterval(() => { indexer.sync(full).catch((e: Error) => log(`Sincronización fallida: ${e.message}`)) }, ms).unref()
every(5 * 60_000, false)
every(24 * 60 * 60_000, true)

for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => { app.close().finally(() => process.exit(0)) })

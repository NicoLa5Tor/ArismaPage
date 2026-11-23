import { timingSafeEqual } from "node:crypto"
import Fastify from "fastify"
import { z } from "zod"
import type { Indexer } from "../application/indexer.js"
import type { SearchService } from "../application/search-service.js"
import { MAX_QUERY_LENGTH } from "../domain/query.js"
import type { CatalogState } from "../application/catalog-state.js"

const age = z.object({ min: z.number().int().min(0).max(99), max: z.number().int().min(0).max(99) }).strict()
const slot = z.enum(["age", "category", "budget"])
/** The previous answer's context, sent back by the browser: checked field by field, never trusted. */
const context = z.object({
  query: z.string().max(MAX_QUERY_LENGTH), text: z.string().max(MAX_QUERY_LENGTH), age: age.nullable(), maxPrice: z.number().positive().max(1e9).nullable(),
  cheap: z.boolean(), offers: z.boolean(), category: z.string().max(120).regex(/^[a-z0-9-]+$/).nullable(),
  shown: z.number().int().min(0).max(200), seen: z.array(z.string().uuid()).max(60).default([]), asked: z.array(slot).max(3), pending: slot.nullable(),
}).strict()
const searchBody = z.object({ q: z.string().trim().min(1).max(MAX_QUERY_LENGTH), context: context.nullish() }).strict()

const sameToken = (given: string | undefined, expected: string) => {
  if (!given) return false
  const a = Buffer.from(given), b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

/**
 * Internal HTTP API. Meant to listen on 127.0.0.1 / a private network only; the public site reaches it through
 * the Next.js route, which adds rate limiting. Queries are never logged.
 */
export function buildServer(deps: { search: SearchService; indexer: Indexer; catalog: CatalogState; ready: () => boolean; reindexToken: string | null }) {
  const app = Fastify({ logger: { level: "warn" }, bodyLimit: 8192, requestTimeout: 10_000 })
  // no per-request access logs: queries are never written anywhere

  app.get("/health", async () => ({ status: deps.ready() ? "ready" : "indexing" }))

  app.get("/suggestions", async () => ({ suggestions: deps.search.starters() }))

  app.post("/search", async (request, reply) => {
    const body = searchBody.safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: "Escribe qué buscas (máximo 200 caracteres)." })
    if (!deps.ready()) return reply.code(503).send({ error: "El buscador se está preparando." })
    return deps.search.answer(body.data.q, body.data.context ?? null)
  })

  app.post("/reindex", async (request, reply) => {
    if (!deps.reindexToken || !sameToken(request.headers["x-search-token"] as string | undefined, deps.reindexToken)) return reply.code(401).send({ error: "No autorizado" })
    return deps.indexer.sync(true)
  })

  return app
}

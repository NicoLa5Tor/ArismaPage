import { NextRequest } from "next/server"

// Entry to the smart search for signed-in shoppers. Validates, rate-limits per account and per IP, talks to the internal search service on a fixed
// host and, if it is down or slow, falls back to the plain catalog search so shoppers always get an answer.

const MAX_LENGTH = 200
const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 20
const SEARCH_TIMEOUT_MS = 1_500
const MAX_CONTEXT_LENGTH = 4_500
const hits = new Map<string, { count: number; resetAt: number }>()

function limited(ip: string): boolean {
  const now = Date.now()
  if (hits.size > 5_000) hits.forEach((value, key) => { if (value.resetAt < now) hits.delete(key) })
  const entry = hits.get(ip)
  if (!entry || entry.resetAt < now) { hits.set(ip, { count: 1, resetAt: now + WINDOW_MS }); return false }
  entry.count += 1
  return entry.count > MAX_PER_WINDOW
}

const clientIp = (request: NextRequest) => request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local"

/** Example questions from the search service (built from the live categories). */
export async function GET() {
  const searchUrl = process.env.ARISMA_SEARCH_URL || "http://127.0.0.1:9002"
  try {
    const response = await fetch(new URL("/suggestions", searchUrl), { cache: "no-store", signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS) })
    if (response.ok) return Response.json(await response.json(), { headers: { "Cache-Control": "public, max-age=300" } })
  } catch {
    // no examples is fine: the chat still works
  }
  return Response.json({ suggestions: [] })
}

/** The signed-in shopper behind the request, asked to the backend with the store cookie. Null when signed out. */
async function shopperId(request: NextRequest): Promise<string | null> {
  const cookie = request.cookies.get("norpress_cliente")?.value
  if (!cookie || cookie.length > 128) return null
  const base = process.env.ARISMA_ADMIN_API_URL || "http://127.0.0.1:9001"
  try {
    const response = await fetch(new URL("/api/shop/session", base), { headers: { cookie: `norpress_cliente=${encodeURIComponent(cookie)}` }, cache: "no-store", signal: AbortSignal.timeout(4_000) })
    if (!response.ok) return null
    const session = await response.json() as { shopper?: { id?: unknown } }
    return typeof session.shopper?.id === "string" ? session.shopper.id : null
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  // the assistant is for signed-in shoppers; the limit is per account, with the address as a second fence
  const shopper = await shopperId(request)
  if (!shopper) return Response.json({ error: "Inicia sesión para hablar con el asistente.", login: true }, { status: 401 })
  if (limited(`cuenta:${shopper}`) || limited(clientIp(request))) return Response.json({ error: "Hiciste muchas búsquedas seguidas. Espera un minuto e inténtalo de nuevo." }, { status: 429 })
  const body = await request.json().catch(() => null) as { q?: unknown; context?: unknown } | null
  const q = typeof body?.q === "string" ? body.q.replace(/\s+/g, " ").trim() : ""
  if (!q || q.length > MAX_LENGTH) return Response.json({ error: "Escribe qué buscas (máximo 200 caracteres)." }, { status: 400 })

  // the conversation so far, as the search service returned it; it validates every field, here only shape and size are checked
  const given = body?.context
  const context = given && typeof given === "object" && !Array.isArray(given) && JSON.stringify(given).length <= MAX_CONTEXT_LENGTH ? given : null

  const searchUrl = process.env.ARISMA_SEARCH_URL || "http://127.0.0.1:9002"
  try {
    const response = await fetch(new URL("/search", searchUrl), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ q, context }), cache: "no-store", signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS) })
    if (response.ok) {
      const answer = await response.json()
      return Response.json({ reply: answer.reply, products: answer.products, suggestions: answer.suggestions, steps: answer.steps, kind: answer.kind === "chat" || answer.kind === "ask" ? answer.kind : "search", handoff: answer.handoff === true, context: answer.context ?? null, source: "smart" }, { headers: { "Cache-Control": "no-store" } })
    }
  } catch {
    // fall through to the basic search
  }
  return basicSearch(q)
}

/** Plain catalog search (words only) through the store's public API, used when the smart search is unavailable. */
async function basicSearch(q: string) {
  const base = process.env.ARISMA_ADMIN_API_URL || "http://127.0.0.1:9001"
  const t0 = Date.now()
  try {
    const url = new URL("/api/public/catalog/products", base)
    url.searchParams.set("q", q)
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(5_000) })
    if (!response.ok) throw new Error()
    const page = await response.json() as { items: unknown[]; total: number; correctedQuery?: string | null }
    const products = page.items.slice(0, 12)
    const searched = page.correctedQuery ? `Busqué «${page.correctedQuery}». ` : ""
    const reply = products.length
      ? `${searched}Encontré ${page.total} ${page.total === 1 ? "producto" : "productos"} con esas palabras. Te muestro los primeros.`
      : `No encontré productos con «${q}». Prueba con otras palabras o escríbenos por WhatsApp.`
    return Response.json({ reply, products, suggestions: [], steps: [{ label: "Buscando en el catálogo", ms: Date.now() - t0 }], kind: "search", handoff: false, context: null, source: "basic" }, { headers: { "Cache-Control": "no-store" } })
  } catch {
    return Response.json({ error: "No pudimos buscar en este momento. Inténtalo de nuevo en unos segundos." }, { status: 503 })
  }
}

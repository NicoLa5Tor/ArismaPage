import { NextRequest } from "next/server"
import { proxyHeaders } from "../../../../modules/shared/adapters/proxy-headers"

// The store's own calls to the backend: /api/arisma-store/shop/... (signed-in shopper) and /api/arisma-store/public/...
// (checkout, orders, reviews). Only those two prefixes are forwarded, always to the configured backend host.
async function forward(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params
  const [area, ...rest] = path
  if ((area !== "shop" && area !== "public") || rest.length === 0) return Response.json({ error: "No encontrado" }, { status: 404 })
  const base = process.env.ARISMA_ADMIN_API_URL || "http://127.0.0.1:9001"
  const url = new URL(`/api/${area}/${rest.map(encodeURIComponent).join("/")}`, base)
  url.search = request.nextUrl.search
  const headers = proxyHeaders(request)
  try {
    const response = await fetch(url, { method: request.method, headers, body: ["GET", "HEAD"].includes(request.method) ? undefined : await request.arrayBuffer(), cache: "no-store", redirect: "manual" })
    const result = new Headers({ "Cache-Control": "no-store" })
    const contentType = response.headers.get("content-type")
    if (contentType) result.set("content-type", contentType)
    const retry = response.headers.get("retry-after")
    if (retry) result.set("retry-after", retry)
    for (const cookie of response.headers.getSetCookie()) result.append("set-cookie", cookie)
    return new Response(response.body, { status: response.status, headers: result })
  } catch {
    return Response.json({ error: "La tienda no está disponible en este momento. Inténtalo de nuevo." }, { status: 503 })
  }
}
export const GET = forward
export const POST = forward
export const PUT = forward
export const DELETE = forward

import { NextRequest } from "next/server"
import { proxyHeaders } from "../../../../modules/shared/adapters/proxy-headers"

// Forward only to the local administrative API; the browser never chooses a host.
async function forward(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params
  const base = process.env.ARISMA_ADMIN_API_URL || "http://127.0.0.1:9001"
  const url = new URL(`/api/admin/${path.map(encodeURIComponent).join("/")}`, base)
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
    return Response.json({ error: "No se puede conectar con el servidor administrativo" }, { status: 503 })
  }
}
export const GET = forward
export const POST = forward
export const PUT = forward
export const DELETE = forward

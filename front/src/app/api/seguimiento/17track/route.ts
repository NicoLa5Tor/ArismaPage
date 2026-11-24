import { NextRequest } from "next/server"
import { proxyHeaders } from "../../../../modules/shared/adapters/proxy-headers"

// Where 17TRACK tells the store that a followed guide changed (its webhook). The body goes to the backend untouched,
// because the backend checks its signature (the "sign" header) against the account key.
export async function POST(request: NextRequest) {
  const base = process.env.ARISMA_ADMIN_API_URL || "http://127.0.0.1:9001"
  const headers = proxyHeaders(request)
  headers.set("content-type", request.headers.get("content-type") ?? "application/json")
  const sign = request.headers.get("sign")
  if (sign) headers.set("sign", sign)
  try {
    const response = await fetch(new URL("/api/public/tracking/17track", base), { method: "POST", headers, body: await request.arrayBuffer(), cache: "no-store", redirect: "manual" })
    return new Response(await response.text(), { status: response.status, headers: { "content-type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } })
  } catch {
    // not 200, so 17TRACK sends it again later
    return new Response("Unavailable", { status: 503 })
  }
}

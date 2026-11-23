import { NextRequest } from "next/server"

// Where Wompi and PayU notify a payment. The body goes to the backend untouched, because its signature is checked there.
const CODES = new Set(["wompi", "payu"])

export async function POST(request: NextRequest, context: { params: Promise<{ code: string }> }) {
  const { code } = await context.params
  if (!CODES.has(code)) return new Response("Not found", { status: 404 })
  const base = process.env.ARISMA_ADMIN_API_URL || "http://127.0.0.1:9001"
  const headers = new Headers({ "content-type": request.headers.get("content-type") ?? "application/json" })
  const checksum = request.headers.get("x-event-checksum")
  if (checksum) headers.set("x-event-checksum", checksum)
  try {
    const response = await fetch(new URL(`/api/public/payments/${code}/webhook`, base), { method: "POST", headers, body: await request.arrayBuffer(), cache: "no-store", redirect: "manual" })
    return new Response(await response.text(), { status: response.status, headers: { "content-type": response.headers.get("content-type") ?? "text/plain", "Cache-Control": "no-store" } })
  } catch {
    // not 200, so the gateway tries again later
    return new Response("Unavailable", { status: 503 })
  }
}

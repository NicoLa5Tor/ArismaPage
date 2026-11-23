import { NextRequest } from "next/server"

// The customer's download link for an invoice, on the store's own domain. The token is the only key; the PDF comes
// from the backend on a fixed host.
export async function GET(_request: NextRequest, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return notFound()
  const base = process.env.ARISMA_ADMIN_API_URL || "http://127.0.0.1:9001"
  try {
    const response = await fetch(new URL(`/api/public/invoices/${encodeURIComponent(token)}`, base), { cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(15_000) })
    if (response.status === 404) return notFound()
    if (!response.ok) throw new Error()
    const headers = new Headers({ "content-type": "application/pdf", "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" })
    const disposition = response.headers.get("content-disposition")
    if (disposition) headers.set("content-disposition", disposition)
    return new Response(response.body, { status: 200, headers })
  } catch {
    return new Response("No pudimos traer la factura en este momento. Inténtalo de nuevo en unos minutos.", { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } })
  }
}

const notFound = () => new Response("Esta factura no existe o el enlace cambió. Pídele a la tienda que te la envíe de nuevo.", { status: 404, headers: { "content-type": "text/plain; charset=utf-8", "X-Robots-Tag": "noindex" } })

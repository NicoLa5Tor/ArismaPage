import { NextRequest } from "next/server"

// Read-only window onto the backend's public catalog (used for uploaded product photos). GET only, fixed host.
export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params
  const base = process.env.ARISMA_ADMIN_API_URL || "http://127.0.0.1:9001"
  const url = new URL(`/api/public/catalog/${path.map(encodeURIComponent).join("/")}`, base)
  url.search = request.nextUrl.search
  try {
    const response = await fetch(url, { cache: "no-store", redirect: "manual" })
    const headers = new Headers({ "Cache-Control": response.headers.get("cache-control") ?? "public, max-age=60" })
    const contentType = response.headers.get("content-type")
    if (contentType) headers.set("content-type", contentType)
    return new Response(response.body, { status: response.status, headers })
  } catch {
    return Response.json({ error: "Catálogo no disponible" }, { status: 503 })
  }
}

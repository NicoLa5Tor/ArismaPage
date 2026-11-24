import { NextResponse, type NextRequest } from "next/server"

/**
 * Development only: the payment gateways send the shopper back to the store's public address (NORPRESS_PUBLIC_URL,
 * e.g. http://arisma.localhost:8000, because Wompi refuses localhost). Cookies belong to one host, so a session opened
 * at http://localhost:8000 would look lost on the way back. Pages opened at localhost go to the public address instead,
 * so the session and the return from the payment live on the same site. In production the store has one domain.
 */
export function proxy(request: NextRequest) {
  const target = process.env.NORPRESS_PUBLIC_URL
  if (process.env.NODE_ENV === "production" || !target || request.method !== "GET") return NextResponse.next()
  let publicUrl: URL
  try { publicUrl = new URL(target) } catch { return NextResponse.next() }
  // the address the browser asked for (in development nextUrl reports the server's own host)
  const host = (request.headers.get("host") ?? "").replace(/:\d+$/, "").toLowerCase()
  if (host === publicUrl.hostname || (host !== "localhost" && host !== "127.0.0.1")) return NextResponse.next()
  const next = new URL(request.nextUrl.pathname + request.nextUrl.search, publicUrl)
  return NextResponse.redirect(next, 307)
}

// pages only: the API routes, Next's own files and static assets answer wherever they are asked
export const config = { matcher: ["/((?!api/|_next/|favicon|.*\\.[a-z0-9]+$).*)"] }

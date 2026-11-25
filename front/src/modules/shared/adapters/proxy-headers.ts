// What the store's Next.js proxies pass on to the backend. The backend trusts X-Forwarded-For only from this proxy (a
// local or private address), so the client address it counts sign-in attempts by is the one the edge saw: Cloudflare's
// CF-Connecting-IP, else the reverse proxy's X-Real-IP or first X-Forwarded-For entry. In production the edge in front of
// Next.js must set or overwrite those headers; a browser that sends them straight to Next.js could choose its address.
const PASSED = ["content-type", "cookie", "x-csrf-token", "x-turnstile-token", "user-agent"]

export function clientAddress(request: Request): string | null {
  const address = request.headers.get("cf-connecting-ip") || request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]
  const clean = address?.trim() ?? ""
  return clean && clean.length <= 64 && /^[0-9a-fA-F.:]+$/.test(clean) ? clean : null
}

export function proxyHeaders(request: Request): Headers {
  const headers = new Headers()
  for (const name of PASSED) {
    const value = request.headers.get(name)
    if (value) headers.set(name, value)
  }
  const client = clientAddress(request)
  if (client) headers.set("x-forwarded-for", client)
  return headers
}

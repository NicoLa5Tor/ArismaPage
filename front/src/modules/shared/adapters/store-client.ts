// HTTP client for the public store's own API, reached through the Next.js route that proxies to the backend.

/** An error the store API explained; `status` lets the UI tell "sign in" (401) from "not allowed" (403) or "busy" (429). */
export class StoreError extends Error {
  constructor(message: string, readonly status: number) { super(message) }
}

/** Announced when an account call finds the session gone (expired, or closed from another device). */
export const SESSION_LOST_EVENT = "arisma:sesion-vencida"

export async function storeRequest<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try { response = await fetch(`/api/arisma-store${path}`, { ...init, cache: "no-store", credentials: "same-origin" }) }
  catch { throw new StoreError("No hay conexión con la tienda. Revisa tu internet e inténtalo de nuevo.", 0) }
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string }
    // a 401 on an account route means the session is gone; the restore call itself just means "signed out"
    if (response.status === 401 && path.startsWith("/shop/") && !path.startsWith("/shop/session") && typeof window !== "undefined") window.dispatchEvent(new Event(SESSION_LOST_EVENT))
    throw new StoreError(body.error || (response.status === 401 ? "Tu sesión se cerró. Vuelve a entrar." : "No se pudo completar la solicitud"), response.status)
  }
  return response.status === 204 ? (undefined as T) : (response.json() as Promise<T>)
}

/** `human` is the Turnstile token, for the calls the store protects against bots (sign-in, sign-up, password reset). */
export function storeJson(method: string, data: unknown, csrf?: string, human?: string): RequestInit {
  return { method, headers: { "Content-Type": "application/json", ...(csrf ? { "X-CSRF-Token": csrf } : {}), ...(human ? { "X-Turnstile-Token": human } : {}) }, body: JSON.stringify(data) }
}

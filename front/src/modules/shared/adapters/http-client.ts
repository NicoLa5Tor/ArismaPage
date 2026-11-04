// HTTP client for the administrative API, reached through the Next.js route that proxies to Quarkus.
export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/arisma-admin${path}`, { ...init, cache: "no-store" })
  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.error || (response.status === 401 ? "Tu sesión venció. Vuelve a iniciar sesión." : "No se pudo completar la solicitud"))
  }
  return response.status === 204 ? undefined as T : response.json()
}
export function json(method: string, data: unknown, csrf?: string): RequestInit {
  return { method, headers: { "Content-Type": "application/json", ...(csrf ? { "X-CSRF-Token": csrf } : {}) }, body: JSON.stringify(data) }
}
/** Query string without empty values. */
export const qs = (params: Record<string, string | number | boolean | null | undefined>) =>
  new URLSearchParams(Object.entries(params).filter(([, v]) => v !== "" && v != null).map(([k, v]) => [k, String(v)])).toString()
export const seg = (value: string) => encodeURIComponent(value)

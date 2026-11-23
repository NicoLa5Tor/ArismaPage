import type { AssistantPort } from "../application/assistant-port"
import type { AssistantAnswer } from "../domain/assistant"

// Browser side: talks only to this site's own /api/buscar route, never to the search service directly.
export const httpAssistant: AssistantPort = {
  async ask(question, context, signal) {
    const response = await fetch("/api/buscar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ q: question, context }), signal })
    const data = await response.json().catch(() => null)
    if (!response.ok) throw new Error(data?.error ?? "No pudimos buscar en este momento. Inténtalo de nuevo.")
    return data as AssistantAnswer
  },
  async suggestions() {
    const response = await fetch("/api/buscar").catch(() => null)
    const data = response?.ok ? await response.json().catch(() => null) : null
    return Array.isArray(data?.suggestions) ? (data.suggestions as string[]).slice(0, 4) : []
  },
}

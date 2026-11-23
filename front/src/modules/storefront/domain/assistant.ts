import type { CatalogProduct } from "./catalog"

// "Pregúntale a Arisma": a search conversation. Answers are ready-made sentences plus real catalog products.

/** What the search service understood so far. Opaque here: it is sent back untouched with the next question. */
export type AssistantContext = Record<string, unknown>

export type AssistantStep = { label: string; ms: number }

export type AssistantAnswer = {
  reply: string
  products: CatalogProduct[]
  suggestions: string[]
  steps: AssistantStep[]
  /**
   * "chat" when the shopper greeted or asked about the store; "ask" when the assistant needs one more detail and
   * `suggestions` holds the choices. Neither lists products.
   */
  kind: "search" | "chat" | "ask"
  /** Null when there is no search in progress (or the basic search answered). */
  context: AssistantContext | null
  /** Offer WhatsApp with a chat reply (shipping costs, warranty, talking to a person). */
  handoff: boolean
  /** "smart" when the search service answered; "basic" when the plain catalog search stood in for it. */
  source: "smart" | "basic"
}

export type AssistantTurn =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "assistant"; query: string; status: "thinking" | "done" | "error" | "stopped"; answer?: AssistantAnswer; error?: string }

export const MAX_QUESTION_LENGTH = 200


export const cleanQuestion = (text: string) => text.replace(/\s+/g, " ").trim().slice(0, MAX_QUESTION_LENGTH)

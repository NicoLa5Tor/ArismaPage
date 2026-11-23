import type { AssistantAnswer, AssistantContext } from "../domain/assistant"

/** Asks the store's smart search. Rejects with a readable message when it cannot answer. */
export interface AssistantPort {
  /** `context` is the one that came with the previous answer, so follow-ups build on it. */
  ask(question: string, context: AssistantContext | null, signal?: AbortSignal): Promise<AssistantAnswer>
  /** Example questions built from the categories that exist today; empty when unavailable. */
  suggestions(): Promise<string[]>
}

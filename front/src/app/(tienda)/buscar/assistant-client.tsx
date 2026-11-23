"use client"

import { httpAssistant } from "../../../modules/storefront/adapters/http-assistant"
import { AssistantView } from "../../../modules/storefront/ui/assistant/assistant-view"

// Composition root for /buscar: hands the browser adapter to the UI, which only knows the port.
export function AssistantClient({ initialQuestion = "" }: { initialQuestion?: string }) {
  return <AssistantView port={httpAssistant} initialQuestion={initialQuestion} />
}

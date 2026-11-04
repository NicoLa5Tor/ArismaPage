import { Check } from "@phosphor-icons/react"
import type { DeliveryMethod } from "../../fulfillment/domain/fulfillment"
import type { OrderStage } from "../domain/stage"
import { Badge, type Tone } from "../../shared/ui/parts"

export const STAGE: Record<OrderStage, { label: string; hint: string; tone: Tone }> = {
  unpaid: { label: "Sin pagar", hint: "Esperando el pago del cliente", tone: "neutral" },
  to_prepare: { label: "Por preparar", hint: "Pagados, hay que alistarlos", tone: "warn" },
  packed: { label: "Empacado", hint: "Listos para enviar o recoger", tone: "info" },
  shipped: { label: "En camino", hint: "Con la transportadora o el mensajero", tone: "info" },
  delivered: { label: "Entregado", hint: "Cerrados", tone: "good" },
  issue: { label: "Requiere atención", hint: "En espera, no entregados o devueltos", tone: "bad" },
  cancelled: { label: "Cancelado", hint: "Cancelados, fallidos o reembolsados", tone: "neutral" },
}
export const stageLabel = (s: OrderStage, m?: DeliveryMethod | null) => s === "packed" && m === "pickup" ? "Listo para recoger" : STAGE[s].label
export const StageBadge = ({ stage, method }: { stage: OrderStage; method?: DeliveryMethod | null }) => <Badge tone={STAGE[stage].tone}>{stageLabel(stage, method)}</Badge>

/** The order's journey in one line: payment → preparation → shipping → delivery (pickup skips shipping). */
export function Journey({ stage, method, cashOnDelivery }: { stage: OrderStage; method: DeliveryMethod; cashOnDelivery: boolean }) {
  const steps = [{ id: "pay", label: cashOnDelivery ? "Pago al entregar" : "Pago" }, { id: "prepare", label: "Preparación" }, ...(method === "pickup" ? [] : [{ id: "ship", label: "Envío" }]), { id: "deliver", label: method === "pickup" ? "Recogida" : "Entrega" }]
  // How many steps are finished in each stage.
  const doneByStage: Record<OrderStage, number> = { unpaid: 0, to_prepare: 1, packed: 2, shipped: 3, delivered: steps.length, issue: 2, cancelled: 0 }
  const done = method === "pickup" && stage === "packed" ? 2 : Math.min(doneByStage[stage], steps.length)
  if (stage === "cancelled") return <p className="glass-banner" role="status"><StageBadge stage="cancelled" />Este pedido ya no sigue el recorrido de entrega.</p>
  return <ol className="glass-steps" aria-label="Recorrido del pedido">{steps.map((s, i) => {
    const state = i < done ? "done" : i === done ? (stage === "issue" ? "bad" : "current") : "todo"
    return <li key={s.id} data-state={state} aria-current={state === "current" ? "step" : undefined}><span className="glass-step-dot" aria-hidden="true">{state === "done" ? <Check size={12} /> : state === "bad" ? "!" : i + 1}</span>{s.label}</li>
  })}</ol>
}

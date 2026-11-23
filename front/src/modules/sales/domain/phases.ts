import type { DeliveryMethod, DeliveryStatus } from "../../shared/domain/statuses"
import type { OrderStage } from "./stage"

/** The phases of an order, in the order the work happens. A pickup order has no shipping phase. */
export type Phase = "pay" | "prepare" | "ship" | "deliver" | "invoice"
export type PhaseState = "done" | "current" | "todo" | "bad"

export function phasesFor(method: DeliveryMethod, cashOnDelivery: boolean): { id: Phase; label: string }[] {
  return [
    { id: "pay", label: cashOnDelivery ? "Pago al entregar" : "Pago" },
    { id: "prepare", label: "Preparación" },
    ...(method === "pickup" ? [] : [{ id: "ship" as const, label: "Envío" }]),
    { id: "deliver", label: method === "pickup" ? "Recogida" : "Entrega" },
    { id: "invoice", label: "Factura" },
  ]
}

/** The phase where the order is now: the one the detail opens on. */
export function currentPhase(stage: OrderStage, deliveryStatus: DeliveryStatus, method: DeliveryMethod): Phase {
  switch (stage) {
    case "unpaid": case "cancelled": return "pay"
    case "to_prepare": return "prepare"
    case "packed": return method === "pickup" ? "deliver" : "ship"
    case "shipped": return "deliver"
    case "issue": return deliveryStatus === "failed" || deliveryStatus === "returned" ? "deliver" : "pay"
    case "to_invoice": case "delivered": return "invoice"
  }
}

/** How far the order went: done before the current phase, current, still to do, or a problem (on hold, not delivered). */
export function phaseState(phase: Phase, stage: OrderStage, deliveryStatus: DeliveryStatus, method: DeliveryMethod): PhaseState {
  if (stage === "cancelled") return "todo"
  if (stage === "delivered") return "done"
  const order = phasesFor(method, false).map(p => p.id)
  const now = order.indexOf(currentPhase(stage, deliveryStatus, method))
  const at = order.indexOf(phase)
  if (at < now) return "done"
  if (at > now) return "todo"
  return stage === "issue" ? "bad" : "current"
}

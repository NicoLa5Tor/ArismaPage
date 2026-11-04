import type { DeliveryMethod, DeliveryStatus } from "../../fulfillment/domain/fulfillment"
import type { OrderStatus } from "./orders"

/** One stage per order, combining payment and delivery (mirrors back/.../V9 v_order_stage). */
export type OrderStage = "unpaid" | "to_prepare" | "packed" | "shipped" | "delivered" | "issue" | "cancelled"
export const STAGES: OrderStage[] = ["unpaid", "to_prepare", "packed", "shipped", "issue", "delivered", "cancelled"]
/** Stages that still need work from the team, in the order the work happens. */
export const WORK_STAGES: OrderStage[] = ["to_prepare", "packed", "shipped", "issue"]

export type FlowContext = { stage: OrderStage; orderStatus: OrderStatus; deliveryStatus: DeliveryStatus; deliveryMethod: DeliveryMethod; paymentMethod: string | null }
/** A step changes either the order (payment, hold, cancel) or its delivery. */
export type StepAction = { kind: "order"; status: OrderStatus } | { kind: "delivery"; status: DeliveryStatus }
export type Step = { id: string; label: string; action: StepAction; tone?: "danger"; form?: boolean; confirm?: string }

const order = (status: OrderStatus): StepAction => ({ kind: "order", status })
const delivery = (status: DeliveryStatus): StepAction => ({ kind: "delivery", status })
const cancel: Step = { id: "cancel", label: "Cancelar pedido", action: order("cancelled"), tone: "danger", confirm: "Se cancela el pedido y su envío; las unidades descontadas vuelven al inventario." }
const hold: Step = { id: "hold", label: "Poner en espera", action: order("on_hold") }

/**
 * The next thing to do with an order, and the other sensible options.
 * Delivering completes the order automatically, so "Marcar entregado" replaces "Marcar completado".
 */
export function flow(c: FlowContext): { primary: Step | null; secondary: Step[] } {
  const pickup = c.deliveryMethod === "pickup"
  const deliver: Step = { id: "deliver", label: "Entregar", action: delivery("delivered"), form: true }
  switch (c.stage) {
    case "unpaid": return { primary: { id: "pay", label: "Confirmar pago", action: order("processing") }, secondary: [hold, cancel] }
    case "to_prepare": return { primary: { id: "pack", label: "Empacar", action: delivery("packed") }, secondary: [{ ...deliver, id: "deliver-now", label: "Ya se entregó" }, hold, cancel] }
    case "packed": return pickup
      ? { primary: deliver, secondary: [{ id: "unpack", label: "Volver a por preparar", action: delivery("pending") }, cancel] }
      : { primary: { id: "ship", label: c.deliveryMethod === "courier" ? "Salió con el mensajero" : "Enviar con guía", action: delivery("shipped"), form: true }, secondary: [{ id: "unpack", label: "Volver a por preparar", action: delivery("pending") }, cancel] }
    case "shipped": return { primary: deliver, secondary: [{ id: "fail", label: "No se entregó", action: delivery("failed"), form: true, tone: "danger" }] }
    case "issue":
      if (c.deliveryStatus === "failed") return { primary: { id: "retry", label: "Reintentar envío", action: delivery("shipped"), form: true }, secondary: [{ id: "returned", label: "Lo devolvieron", action: delivery("returned"), confirm: "El envío queda como devuelto; decide luego si cancelas o reembolsas el pedido." }, cancel] }
      if (c.orderStatus === "on_hold") return { primary: { id: "resume", label: "Reanudar", action: order("processing") }, secondary: [cancel] }
      return { primary: null, secondary: c.orderStatus === "processing" ? [{ id: "refund", label: "Reembolsar", action: order("refunded"), tone: "danger", confirm: "El pedido queda reembolsado; las unidades descontadas vuelven al inventario." }, cancel] : [cancel] }
    case "delivered": return { primary: null, secondary: c.orderStatus === "completed" ? [{ id: "refund", label: "Reembolsar", action: order("refunded"), tone: "danger", confirm: "El pedido queda reembolsado; las unidades descontadas vuelven al inventario." }] : [] }
    default: return { primary: null, secondary: [] }
  }
}
/** Steps that can be applied to many orders at once without asking for data. */
export const BULK_STEPS: Partial<Record<OrderStage, Step>> = {
  to_prepare: { id: "pack", label: "Empacar", action: delivery("packed") },
  packed: { id: "deliver", label: "Entregar", action: delivery("delivered") },
  shipped: { id: "deliver", label: "Entregar", action: delivery("delivered") },
}

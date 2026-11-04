import type { ImageRef } from "../../shared/domain/image"

export type DeliveryStatus = "pending" | "packed" | "shipped" | "delivered" | "failed" | "returned" | "cancelled"
export type DeliveryMethod = "carrier" | "courier" | "pickup"
/** Same transitions as back/.../fulfillment/domain/FulfillmentStatus.java. */
const NEXT: Record<DeliveryStatus, DeliveryStatus[]> = {
  pending: ["packed", "shipped", "delivered"], packed: ["pending", "shipped", "delivered"], shipped: ["delivered", "failed"],
  failed: ["shipped", "returned"], delivered: [], returned: [], cancelled: [],
}
export function nextStatuses(status: DeliveryStatus, method: DeliveryMethod): DeliveryStatus[] {
  return NEXT[status].filter(s => !(method === "pickup" && s === "shipped"))
}
/** The usual next step, offered as the main button. */
export function primaryStep(status: DeliveryStatus, method: DeliveryMethod): DeliveryStatus | null {
  if (status === "pending") return "packed"
  if (status === "packed") return method === "pickup" ? "delivered" : "shipped"
  if (status === "shipped") return "delivered"
  if (status === "failed") return "shipped"
  return null
}
export const isOpen = (s: DeliveryStatus) => s === "pending" || s === "packed" || s === "shipped" || s === "failed"
/** Steps shown for a method: pickup never goes "on its way". */
export const stepsFor = (method: DeliveryMethod): DeliveryStatus[] => method === "pickup" ? ["pending", "packed", "delivered"] : ["pending", "packed", "shipped", "delivered"]
/** What the next step needs before the team can confirm it (mirrors back/.../Shipment.move). */
export function missing(next: DeliveryStatus, method: DeliveryMethod, d: MoveDetails): string | null {
  if (next === "shipped" && method === "carrier" && (!d.carrier?.trim() || !d.trackingCode?.trim())) return "Escribe la transportadora y el número de guía"
  if (next === "shipped" && method === "courier" && !d.courierUserId && !d.courierName?.trim()) return "Indica quién lleva el pedido"
  if (next === "failed" && !d.reason?.trim()) return "Cuéntanos por qué no se entregó"
  return null
}
export const CARRIERS = ["Servientrega", "Interrapidísimo", "Coordinadora", "Envía", "TCC", "Deprisa", "Domina", "4-72"]

export type MoveDetails = { carrier?: string; trackingCode?: string; courierUserId?: string | null; courierName?: string; recipientName?: string; reason?: string; note?: string }
export type ShipmentEvent = { id: string; fromStatus: DeliveryStatus | null; toStatus: DeliveryStatus; note: string; createdAt: string; actor: string | null }
export type Shipment = { id: string; method: DeliveryMethod; status: DeliveryStatus; carrier: string | null; trackingCode: string | null; courierUserId: string | null; courier: string | null
  recipientName: string | null; failureReason: string | null; packedAt: string | null; shippedAt: string | null; deliveredAt: string | null; updatedAt: string; updatedBy: string | null
  paid: boolean; cashOnDelivery: boolean; events: ShipmentEvent[] }
export type BoardCard = ImageRef & { orderId: string; number: string; stage: "to_prepare" | "packed" | "shipped" | "issue"; status: DeliveryStatus; method: DeliveryMethod; carrier: string | null; trackingCode: string | null; courier: string | null; failureReason: string | null
  updatedAt: string; placedAt: string; total: number; orderStatus: string; paymentMethod: string | null; paid: boolean; customerName: string | null; city: string | null; phone: string | null; units: number; lines: number }
export type Board = { cards: BoardCard[]; counts: Record<string, number>; stale: number; staleDays: number; deliveredToday: number }
export type Courier = { id: string; name: string; role: string }
export type BulkResult = { updated: number; failed: { orderId: string; error: string }[] }

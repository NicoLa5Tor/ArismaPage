import type { ImageRef } from "../../shared/domain/image"
import { numberError, type TrackingEvent, type TrackingStage } from "../../shared/domain/carriers"

import type { DeliveryMethod, DeliveryStatus } from "../../shared/domain/statuses"
export type { DeliveryMethod, DeliveryStatus }
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
  if (next === "shipped" && method === "carrier") {
    if (!d.carrierCode && !d.carrier?.trim()) return "Elige la transportadora"
    const bad = numberError(d.trackingCode ?? "")
    if (bad) return bad
  }
  if (next === "shipped" && method === "courier" && !d.courierUserId && !d.courierName?.trim()) return "Indica quién lleva el pedido"
  if (next === "failed" && !d.reason?.trim()) return "Cuéntanos por qué no se entregó"
  return null
}

/** Automatic tracking of one carrier shipment. state "rejected" carries the reason in error. */
export type ShipmentTracking = { state: "following" | "rejected" | "finished"; stage: TrackingStage | null; stageLabel: string | null; error: string | null; checkedAt: string | null; changedAt: string | null; events: TrackingEvent[] }
/** The store's switch, its plan and this month's use (limit shipments a month, Bogotá time). ready: the server has the provider's key. */
/** The 17TRACK account as its API reports it now: numbers it can still register. dailyLimit 0 means no daily limit. */
export type ProviderAccount = { total: number; used: number; remaining: number; usedToday: number; dailyLimit: number }
/**
 * keySource: where the 17TRACK key comes from ("panel": saved by the store; "servidor": the server's), null without one.
 * account: what 17TRACK reports right now; null with accountError when it did not answer.
 */
export type TrackingStatus = { enabled: boolean; ready: boolean; plan: "free" | "plus"; planLabel: string; limit: number; used: number; remaining: number; month: string
  keySource: "panel" | "servidor" | null; account: ProviderAccount | null; accountError: string | null
  /** Address to paste in 17TRACK → Webhook; webhookReachable is false while the store is not on a public https address. */
  webhookUrl: string; webhookReachable: boolean }

/** carrierCode: one of the store's carriers (else carrier is a name typed by hand); follow: follow the guide automatically or give the shopper only the link. */
export type MoveDetails = { carrierCode?: string | null; follow?: boolean; carrier?: string; trackingCode?: string; courierUserId?: string | null; courierName?: string; recipientName?: string; reason?: string; note?: string }
export type ShipmentEvent = { id: string; fromStatus: DeliveryStatus | null; toStatus: DeliveryStatus; note: string; createdAt: string; actor: string | null }
export type Shipment = { id: string; method: DeliveryMethod; status: DeliveryStatus; carrier: string | null; trackingCode: string | null; carrierCode?: string | null; follow?: boolean; trackingUrl?: string | null; opensGuide?: boolean | null; courierUserId: string | null; courier: string | null
  recipientName: string | null; failureReason: string | null; packedAt: string | null; shippedAt: string | null; deliveredAt: string | null; updatedAt: string; updatedBy: string | null
  paid: boolean; cashOnDelivery: boolean; events: ShipmentEvent[]; tracking: ShipmentTracking | null }
export type BoardCard = ImageRef & { orderId: string; number: string; stage: "to_prepare" | "packed" | "shipped" | "issue"; status: DeliveryStatus; method: DeliveryMethod; carrier: string | null; trackingCode: string | null; courier: string | null; failureReason: string | null
  updatedAt: string; placedAt: string; total: number; orderStatus: string; paymentMethod: string | null; paid: boolean; customerName: string | null; city: string | null; phone: string | null; units: number; lines: number }
export type Board = { cards: BoardCard[]; counts: Record<string, number>; stale: number; staleDays: number; deliveredToday: number }
export type Courier = { id: string; name: string; role: string }
export type BulkResult = { updated: number; failed: { orderId: string; error: string }[] }

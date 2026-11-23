import type { Page } from "../../shared/domain/page"
import type { DeliveryMethod, DeliveryStatus, OrderStatus } from "../../shared/domain/statuses"
import type { OrderStage } from "./stage"

export type { OrderStatus }
export const ORDER_STATUSES: OrderStatus[] = ["processing", "pending", "on_hold", "completed", "cancelled", "failed", "refunded"]
/** Same transitions as back/.../sales/domain/OrderStatus.java, so the panel only offers valid moves. */
export const NEXT_STATUS: Record<OrderStatus, OrderStatus[]> = {
  pending: ["processing", "on_hold", "cancelled", "failed"], on_hold: ["processing", "cancelled"], processing: ["completed", "on_hold", "cancelled", "refunded"],
  completed: ["refunded"], failed: ["pending", "cancelled"], cancelled: [], refunded: [],
}
/** Leaving the sold states returns reduced stock; the panel asks for confirmation first. */
export const releasesStock = (s: OrderStatus) => s === "cancelled" || s === "refunded" || s === "failed"
/** Statuses every selected order can move to. */
export const commonNextStatuses = (statuses: OrderStatus[]) => statuses.length === 0 ? [] : ORDER_STATUSES.filter(s => statuses.every(from => NEXT_STATUS[from].includes(s)))

export type OrderRow = { id: string; number: string; status: OrderStatus; placedAt: string; total: number; paymentMethod: string | null; paymentMethodTitle: string | null; customerId: string | null; customerName: string | null; customerEmail: string | null; units: number; shipping: string | null; stage: OrderStage; deliveryStatus: DeliveryStatus; deliveryMethod: DeliveryMethod; trackingCode: string | null; city: string | null }
export type OrderList = Page<OrderRow> & { amount: number; stageCounts: Partial<Record<OrderStage, number>> }
export type OrderLine = { id: string; productId: string | null; sku: string | null; title: string; quantity: number; unitPrice: number; subtotal: number; discount: number; tax: number; total: number; taxRatePercent: number | null; stockReduced: number; productSlug: string | null; currentTitle: string | null; imageId: string | null; imageUrl: string | null; imageUploaded: boolean | null }
export type { Note } from "../../shared/domain/note"
import type { Note } from "../../shared/domain/note"
export type Address = Partial<Record<"first_name" | "last_name" | "company" | "address_1" | "address_2" | "city" | "state" | "postcode" | "country" | "phone" | "email" | "id" | "id_type", string | null>>
import type { InvoiceSummary } from "./invoice"

export type OrderDetail = {
  id: string; number: string; status: OrderStatus; currency: string; subtotal: number; discountTotal: number; shippingTotal: number; taxTotal: number; total: number
  paymentMethod: string | null; paymentMethodTitle: string | null; createdVia: string | null; placedAt: string; paidAt: string | null; completedAt: string | null
  billing: Address; shipping: Address; customerNote: string; customerId: string | null
  stage: OrderStage; deliveryStatus: DeliveryStatus; deliveryMethod: DeliveryMethod
  customer: { id: string; email: string | null; firstName: string; lastName: string; phone: string | null; documentType: string | null; documentNumber: string | null; hasAccount: boolean; orders: number; totalSpent: number } | null
  lines: OrderLine[]; shippingLines: { id: string; method: string; label: string; cost: number; tax: number; trackingCode: string | null; carrier: string | null }[]
  discounts: { id: string; code: string; amount: number; tax: number }[]; payments: { id: string; provider: string; externalId: string | null; paymentType: string | null; status: string; amount: number | null; paidAt: string | null }[]
  /** Store orders: test mode, when an unpaid one is cancelled, the account that placed it and every try at paying it. */
  test?: boolean; expiresAt?: string | null; accountEmail?: string | null
  attempts?: { reference: string; gateway: string; amount: number; sandbox: boolean; status: string; externalId: string | null; detail: string; createdAt: string; updatedAt: string }[]
  history: { id: string; fromStatus: OrderStatus | null; toStatus: OrderStatus; note: string; createdAt: string; actor: string | null }[]; notes: Note[]; quote: { id: string; number: string } | null
  /** Null while no invoice was attached and the order was not marked as not needing one. */
  invoice?: InvoiceSummary | null
  /** In the history (finished, cancelled, or brought from the previous store); migrated: from WooCommerce; keptActive: brought back to the work list. */
  inHistory?: boolean; migrated?: boolean; keptActive?: boolean
}
export type BulkResult = { updated: number; failed: { id: string; error: string }[] }

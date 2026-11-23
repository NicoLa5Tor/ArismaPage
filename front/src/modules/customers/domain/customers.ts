import type { OrderStatus, QuoteStatus } from "../../shared/domain/statuses"

export type CustomerSort = "recent" | "spent" | "orders" | "name"
export type CustomerRow = { id: string; email: string | null; firstName: string; lastName: string; phone: string | null; hasAccount: boolean; createdAt: string; orders: number; totalSpent: number; lastOrderAt: string | null; city: string | null }
/** Detail: paidOrders is the count; orders is the full list (paid or not). */
export type CustomerDetail = Omit<CustomerRow, "orders"> & { paidOrders: number; documentType: string | null; documentNumber: string | null; company: string | null
  addresses: { kind: "billing" | "shipping"; firstName: string; lastName: string; line1: string; line2: string; city: string; state: string; postcode: string; country: string; phone: string | null }[]
  /** The addresses the customer saved in their store account, the default one first. */
  book?: { id: string; label: "casa" | "trabajo" | "otro"; recipient: string; phone: string; state: string; city: string; neighborhood: string; street: string; detail: string; instructions: string; isDefault: boolean }[]
  orders: { id: string; number: string; status: OrderStatus; placedAt: string; total: number; units: number; paymentMethod: string | null }[]; quotes: { id: string; number: string; status: QuoteStatus; createdAt: string; total: number }[]
  topProducts: { productId: string | null; title: string; units: number; total: number; imageId: string | null; imageUrl: string | null; imageUploaded: boolean | null }[] }
export const fullName = (c: { firstName?: string | null; lastName?: string | null }) => [c.firstName, c.lastName].filter(Boolean).join(" ") || "Sin nombre"

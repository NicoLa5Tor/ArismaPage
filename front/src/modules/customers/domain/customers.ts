import type { OrderStatus } from "../../sales/domain/orders"
import type { QuoteStatus } from "../../quotes/domain/quotes"

export type CustomerSort = "recent" | "spent" | "orders" | "name"
export type CustomerRow = { id: string; email: string | null; firstName: string; lastName: string; phone: string | null; hasAccount: boolean; createdAt: string; orders: number; totalSpent: number; lastOrderAt: string | null; city: string | null }
/** Detail: paidOrders is the count; orders is the full list (paid or not). */
export type CustomerDetail = Omit<CustomerRow, "orders"> & { paidOrders: number; documentType: string | null; documentNumber: string | null; company: string | null
  addresses: { kind: "billing" | "shipping"; firstName: string; lastName: string; line1: string; line2: string; city: string; state: string; postcode: string; country: string; phone: string | null }[]
  orders: { id: string; number: string; status: OrderStatus; placedAt: string; total: number; units: number; paymentMethod: string | null }[]; quotes: { id: string; number: string; status: QuoteStatus; createdAt: string; total: number }[]
  topProducts: { productId: string | null; title: string; units: number; total: number; imageId: string | null; imageUrl: string | null; imageUploaded: boolean | null }[] }
export const fullName = (c: { firstName?: string | null; lastName?: string | null }) => [c.firstName, c.lastName].filter(Boolean).join(" ") || "Sin nombre"

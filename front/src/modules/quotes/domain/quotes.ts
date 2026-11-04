import type { Note } from "../../shared/domain/note"

export type QuoteStatus = "pending" | "accepted" | "rejected" | "expired" | "converted"
export const QUOTE_STATUSES: QuoteStatus[] = ["pending", "accepted", "rejected", "expired", "converted"]
/** Converted quotes became orders and are final; the others are follow-up states set by hand. */
export const MANUAL_QUOTE_STATUSES: QuoteStatus[] = ["accepted", "rejected", "expired", "pending"]
export type QuoteRow = { id: string; number: string; status: QuoteStatus; name: string; email: string | null; createdAt: string; expiresAt: string | null; total: number; orderId: string | null; orderNumber: string | null; units: number; overdue: boolean }
export type QuoteDetail = QuoteRow & { message: string; customerId: string | null; subtotal: number; taxTotal: number; phone: string | null
  lines: { id: string; productId: string | null; sku: string | null; title: string; quantity: number; unitPrice: number; total: number; productSlug: string | null; stockQuantity: number | null; manageStock: boolean | null; stockStatus: string | null; imageId: string | null; imageUrl: string | null; imageUploaded: boolean | null }[]; notes: Note[] }

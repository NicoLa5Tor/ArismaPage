// Status words several modules share (an order's, a quote's, a delivery's). Mirrors the backend enums.
export type OrderStatus = "pending" | "on_hold" | "processing" | "completed" | "cancelled" | "failed" | "refunded"
export type QuoteStatus = "pending" | "accepted" | "rejected" | "expired" | "converted"
export type DeliveryStatus = "pending" | "packed" | "shipped" | "delivered" | "failed" | "returned" | "cancelled"
export type DeliveryMethod = "carrier" | "courier" | "pickup"

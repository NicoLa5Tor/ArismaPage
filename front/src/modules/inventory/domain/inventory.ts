export type MovementKind = "manual" | "sale" | "cancel" | "import"
export const MOVEMENT_KINDS: MovementKind[] = ["sale", "cancel", "manual", "import"]
export type Movement = { id: string; kind: MovementKind; productId: string; title: string; sku: string | null; quantityBefore: number | null; quantityAfter: number | null; quantityDelta: number | null; reason: string; createdAt: string; actor: string | null; orderId: string | null; orderNumber: string | null }
export type LowStock = { id: string; title: string; sku: string | null; stockQuantity: number; stockStatus: string; backorders: string; unitsLast180Days: number }

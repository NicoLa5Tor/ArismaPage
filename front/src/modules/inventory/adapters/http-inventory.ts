import type { InventoryPort } from "../application/inventory-port"
import { PAGE_SIZE } from "../../shared/domain/page"
import { qs, request } from "../../shared/adapters/http-client"

export const httpInventory: InventoryPort = {
  movements(kind, q, offset) { return request(`/inventory/movements?${qs({ kind, q, limit: PAGE_SIZE, offset })}`) },
  lowStock(threshold) { return request(`/inventory/low-stock?threshold=${threshold}`) },
}

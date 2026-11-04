import type { Page } from "../../shared/domain/page"
import type { LowStock, Movement, MovementKind } from "../domain/inventory"

export interface InventoryPort {
  movements(kind: MovementKind | "", q: string, offset: number): Promise<Page<Movement>>
  lowStock(threshold: number): Promise<LowStock[]>
}

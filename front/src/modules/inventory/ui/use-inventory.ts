import type { InventoryPort } from "../application/inventory-port"
import { usePort } from "../../shared/ui/admin-context"
export const useInventoryPort = () => usePort<InventoryPort>("inventory")

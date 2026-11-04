import type { OrdersPort } from "../application/orders-port"
import { usePort } from "../../shared/ui/admin-context"
export const useOrdersPort = () => usePort<OrdersPort>("orders")

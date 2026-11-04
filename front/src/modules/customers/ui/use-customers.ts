import type { CustomersPort } from "../application/customers-port"
import { usePort } from "../../shared/ui/admin-context"
export const useCustomersPort = () => usePort<CustomersPort>("customers")

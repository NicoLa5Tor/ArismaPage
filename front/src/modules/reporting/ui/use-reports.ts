import type { ReportsPort } from "../application/reports-port"
import { usePort } from "../../shared/ui/admin-context"
export const useReportsPort = () => usePort<ReportsPort>("reports")

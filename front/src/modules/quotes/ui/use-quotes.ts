import type { QuotesPort } from "../application/quotes-port"
import { usePort } from "../../shared/ui/admin-context"
export const useQuotesPort = () => usePort<QuotesPort>("quotes")

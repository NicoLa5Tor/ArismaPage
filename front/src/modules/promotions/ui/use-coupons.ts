import type { CouponsPort } from "../application/coupons-port"
import { usePort } from "../../shared/ui/admin-context"
export const useCouponsPort = () => usePort<CouponsPort>("coupons")

import type { FulfillmentPort } from "../application/fulfillment-port"
import { usePort } from "../../shared/ui/admin-context"
export const useFulfillmentPort = () => usePort<FulfillmentPort>("fulfillment")

// Composition: the HTTP adapter that implements each module's port. Only the app's composition root imports this file.
import { httpCatalog } from "../../catalog/adapters/http-catalog"
import { httpCustomers } from "../../customers/adapters/http-customers"
import { httpInventory } from "../../inventory/adapters/http-inventory"
import { httpCoupons } from "../../promotions/adapters/http-coupons"
import { httpQuotes } from "../../quotes/adapters/http-quotes"
import { httpReports } from "../../reporting/adapters/http-reports"
import { httpOrders } from "../../sales/adapters/http-orders"
import { httpMedia } from "../../shared/adapters/http-media"
import { httpUsers } from "../../identity/adapters/http-users"
import { httpFulfillment } from "../../fulfillment/adapters/http-fulfillment"

/** Keys match each module's usePort key (useCatalogPort → "catalog", …). */
export const httpPorts = { catalog: httpCatalog, orders: httpOrders, customers: httpCustomers, quotes: httpQuotes, inventory: httpInventory, coupons: httpCoupons, reports: httpReports, media: httpMedia, users: httpUsers, fulfillment: httpFulfillment }
export { httpSession } from "../../identity/adapters/http-session"

import type { ReportsPort } from "../application/reports-port"
import { qs, request } from "../../shared/adapters/http-client"

const range = (r: { from: string; to: string }) => qs({ from: r.from, to: r.to })
export const httpReports: ReportsPort = {
  summary(r) { return request(`/reports/summary?${range(r)}`) },
  salesByMonth(r) { return request(`/reports/sales-by-month?${range(r)}`) },
  topProducts(r, limit) { return request(`/reports/top-products?${range(r)}&limit=${limit}`) },
  paymentMethods(r) { return request(`/reports/payment-methods?${range(r)}`) },
  shippingMethods(r) { return request(`/reports/shipping-methods?${range(r)}`) },
}

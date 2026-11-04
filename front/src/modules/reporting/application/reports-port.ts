import type { DateRange } from "../../shared/domain/page"
import type { MethodSales, MonthSales, ShippingMethod, Summary, TopProduct } from "../domain/reports"

export interface ReportsPort {
  summary(range: DateRange): Promise<Summary>
  salesByMonth(range: DateRange): Promise<MonthSales[]>
  topProducts(range: DateRange, limit: number): Promise<TopProduct[]>
  paymentMethods(range: DateRange): Promise<MethodSales[]>
  shippingMethods(range: DateRange): Promise<ShippingMethod[]>
}

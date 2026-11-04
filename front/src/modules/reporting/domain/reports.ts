type Totals = { orders: number; sales: number; avgTicket: number; tax: number; shipping: number; discount: number; units: number }
export type Summary = Totals & { from: string; to: string; previous: Totals; newCustomers: number; queue: { processing: number; onHold: number; pending: number; openQuotes: number; lowStock: number; toDispatch: number; inTransit: number; issues: number; unpaid: number } }
export type MonthSales = { month: string; orders: number; sales: number }
export type TopProduct = { productId: string | null; title: string; sku: string | null; units: number; net: number; orders: number; stockQuantity: number | null; imageId: string | null; imageUrl: string | null; imageUploaded: boolean | null }
export type MethodSales = { method: string; title: string; orders: number; sales: number }
export type ShippingMethod = { method: string; label: string; orders: number; cost: number }

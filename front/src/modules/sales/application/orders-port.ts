import type { DateRange } from "../../shared/domain/page"
import type { BulkResult, Note, OrderDetail, OrderList, OrderStatus } from "../domain/orders"

/** stage: comma-separated stages (e.g. "to_prepare,packed"), or "" for all. */
export type OrderFilter = DateRange & { status: OrderStatus | ""; q: string; offset: number; stage: string }
export interface OrdersPort {
  list(filter: OrderFilter): Promise<OrderList>
  get(id: string): Promise<OrderDetail>
  changeStatus(id: string, status: OrderStatus, note: string, csrf: string): Promise<OrderDetail>
  changeStatuses(ids: string[], status: OrderStatus, note: string, csrf: string): Promise<BulkResult>
  addNote(id: string, body: string, csrf: string): Promise<Note>
}

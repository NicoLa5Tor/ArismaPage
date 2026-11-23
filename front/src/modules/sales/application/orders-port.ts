import type { DateRange } from "../../shared/domain/page"
import type { BulkResult, Note, OrderDetail, OrderList, OrderStatus } from "../domain/orders"
import type { Invoice } from "../domain/invoice"

/** stage: comma-separated stages (e.g. "to_prepare,packed"), or "" for all. */
/** history: finished, cancelled and migrated orders instead of the work list. */
export type OrderFilter = DateRange & { status: OrderStatus | ""; q: string; offset: number; stage: string; history?: boolean }
export interface OrdersPort {
  list(filter: OrderFilter): Promise<OrderList>
  get(id: string): Promise<OrderDetail>
  changeStatus(id: string, status: OrderStatus, note: string, csrf: string): Promise<OrderDetail>
  changeStatuses(ids: string[], status: OrderStatus, note: string, csrf: string): Promise<BulkResult>
  addNote(id: string, body: string, csrf: string): Promise<Note>
  /** A payment received outside the gateways (a transfer, cash at the shop): the order moves to processing. */
  registerPayment(id: string, reference: string, csrf: string): Promise<void>
  /** Asks the gateway about a payment still open on the order; answers its state ("approved"…) or "" when there was nothing to ask. */
  checkPayment(id: string, csrf: string): Promise<string>
  invoice(id: string): Promise<Invoice>
  /** Uploads the PDF (replacing the previous one); `number` is the invoice number, optional. */
  attachInvoice(id: string, file: File, number: string, csrf: string): Promise<Invoice>
  /** Emails the PDF to the customer, or to `to` when given; fails with the mail server's answer. */
  emailInvoice(id: string, to: string, csrf: string): Promise<Invoice>
  /** WhatsApp was opened with the link: the invoice counts as sent. */
  whatsappInvoice(id: string, csrf: string): Promise<Invoice>
  invoiceNotNeeded(id: string, csrf: string): Promise<Invoice>
  /** Where the panel opens the PDF. */
  invoiceFileUrl(id: string): string
  /** A migrated order back on the work list (true) or in the history again (false). */
  keepActive(id: string, active: boolean, csrf: string): Promise<OrderDetail>
}

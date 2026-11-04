import type { Page } from "../../shared/domain/page"
import type { QuoteDetail, QuoteRow, QuoteStatus } from "../domain/quotes"

export interface QuotesPort {
  list(status: QuoteStatus | "", q: string, offset: number): Promise<Page<QuoteRow>>
  get(id: string): Promise<QuoteDetail>
  changeStatus(id: string, status: QuoteStatus, note: string, csrf: string): Promise<QuoteDetail>
}

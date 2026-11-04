import type { Page } from "../../shared/domain/page"
import type { CustomerDetail, CustomerRow, CustomerSort } from "../domain/customers"

export interface CustomersPort {
  list(q: string, buyersOnly: boolean, sort: CustomerSort, offset: number): Promise<Page<CustomerRow>>
  get(id: string): Promise<CustomerDetail>
}

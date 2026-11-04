import type { CustomersPort } from "../application/customers-port"
import { PAGE_SIZE } from "../../shared/domain/page"
import { qs, request, seg } from "../../shared/adapters/http-client"

export const httpCustomers: CustomersPort = {
  list(q, buyers, sort, offset) { return request(`/customers?${qs({ q, buyers, sort, limit: PAGE_SIZE, offset })}`) },
  get(id) { return request(`/customers/${seg(id)}`) },
}

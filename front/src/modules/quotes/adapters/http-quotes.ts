import type { QuotesPort } from "../application/quotes-port"
import { PAGE_SIZE } from "../../shared/domain/page"
import { json, qs, request, seg } from "../../shared/adapters/http-client"

export const httpQuotes: QuotesPort = {
  list(status, q, offset) { return request(`/quotes?${qs({ status, q, limit: PAGE_SIZE, offset })}`) },
  get(id) { return request(`/quotes/${seg(id)}`) },
  changeStatus(id, status, note, csrf) { return request(`/quotes/${seg(id)}/status`, json("POST", { status, note }, csrf)) },
}

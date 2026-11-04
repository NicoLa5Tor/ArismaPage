import type { OrdersPort } from "../application/orders-port"
import { PAGE_SIZE } from "../../shared/domain/page"
import { json, qs, request, seg } from "../../shared/adapters/http-client"

export const httpOrders: OrdersPort = {
  list(f) { return request(`/orders?${qs({ status: f.status, from: f.from, to: f.to, q: f.q, stage: f.stage, limit: PAGE_SIZE, offset: f.offset })}`) },
  get(id) { return request(`/orders/${seg(id)}`) },
  changeStatus(id, status, note, csrf) { return request(`/orders/${seg(id)}/status`, json("POST", { status, note }, csrf)) },
  changeStatuses(ids, status, note, csrf) { return request("/orders/status", json("POST", { ids, status, note }, csrf)) },
  addNote(id, body, csrf) { return request(`/orders/${seg(id)}/notes`, json("POST", { body }, csrf)) },
}

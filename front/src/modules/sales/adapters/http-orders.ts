import type { OrdersPort } from "../application/orders-port"
import { PAGE_SIZE } from "../../shared/domain/page"
import { json, qs, request, seg } from "../../shared/adapters/http-client"

export const httpOrders: OrdersPort = {
  list(f) { return request(`/orders?${qs({ status: f.status, from: f.from, to: f.to, q: f.q, stage: f.stage, historial: f.history ? "true" : "", limit: PAGE_SIZE, offset: f.offset })}`) },
  get(id) { return request(`/orders/${seg(id)}`) },
  changeStatus(id, status, note, csrf) { return request(`/orders/${seg(id)}/status`, json("POST", { status, note }, csrf)) },
  changeStatuses(ids, status, note, csrf) { return request("/orders/status", json("POST", { ids, status, note }, csrf)) },
  addNote(id, body, csrf) { return request(`/orders/${seg(id)}/notes`, json("POST", { body }, csrf)) },
  async checkPayment(id, csrf) { return (await request<{ status: string }>(`/orders/${seg(id)}/payment/check`, { method: "POST", headers: { "X-CSRF-Token": csrf } })).status },
  async registerPayment(id, reference, csrf) { await request(`/orders/${seg(id)}/payment`, json("POST", { reference }, csrf)) },
  invoice(id) { return request(`/orders/${seg(id)}/invoice`) },
  attachInvoice(id, file, number, csrf) { return request(`/orders/${seg(id)}/invoice?${qs({ numero: number.trim() })}`, { method: "POST", headers: { "Content-Type": "application/octet-stream", "X-CSRF-Token": csrf }, body: file }) },
  emailInvoice(id, to, csrf) { return request(`/orders/${seg(id)}/invoice/email`, json("POST", { to: to.trim() || null }, csrf)) },
  whatsappInvoice(id, csrf) { return request(`/orders/${seg(id)}/invoice/whatsapp`, { method: "POST", headers: { "X-CSRF-Token": csrf } }) },
  invoiceNotNeeded(id, csrf) { return request(`/orders/${seg(id)}/invoice/not-needed`, { method: "POST", headers: { "X-CSRF-Token": csrf } }) },
  invoiceFileUrl(id) { return `/api/arisma-admin/orders/${seg(id)}/invoice/file` },
  keepActive(id, active, csrf) { return request(`/orders/${seg(id)}/active`, json("POST", { active }, csrf)) },
}

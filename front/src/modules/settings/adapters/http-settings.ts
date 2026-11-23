import type { SettingsPort } from "../application/settings-port"
import { json, qs, request, seg } from "../../shared/adapters/http-client"

export const httpSettings: SettingsPort = {
  load: () => request("/settings"),
  saveStore: (value, csrf) => request("/settings/store", json("PUT", value, csrf)),
  saveConversations: (value, csrf) => request("/settings/conversations", json("PUT", value, csrf)),
  saveShipping: (value, csrf) => request("/settings/shipping", json("PUT", value, csrf)),
  saveCheckout: (value, csrf) => request("/settings/checkout", json("PUT", value, csrf)),
  saveProductPage: (value, csrf) => request("/settings/product-page", json("PUT", value, csrf)),
  choosePayments: (active, mode, csrf) => request("/settings/payments", json("PUT", { active, mode }, csrf)),
  saveCredentials: (code, environment, change, csrf) => request(`/settings/payments/${seg(code)}/${seg(environment)}`, json("PUT", change, csrf)),
  loadMail: () => request("/settings/mail"),
  saveMail: (value, password, csrf) => request("/settings/mail", json("PUT", { ...value, password }, csrf)),
  async sendTestMail(to, csrf) { return (await request<{ result: string }>("/mail/test", json("POST", { to }, csrf))).result },
  outbox: (limit, offset) => request(`/mail/outbox?${qs({ limit, offset })}`),
}

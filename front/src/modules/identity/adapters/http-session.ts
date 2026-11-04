import type { Session, SessionPort } from "../application/session-port"
import { json, request } from "../../shared/adapters/http-client"

export const httpSession: SessionPort = {
  async restore() { try { return await request<Session>("/session") } catch { return null } },
  login(email, password) { return request<Session>("/session", json("POST", { email, password })) },
  logout(csrf) { return request("/session", { method: "DELETE", headers: { "X-CSRF-Token": csrf } }) },
  changePassword(current, next, csrf) { return request("/me/password", json("PUT", { current, next }, csrf)) },
}

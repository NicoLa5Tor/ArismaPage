import type { Session, SessionPort } from "../application/session-port"
import { json, request } from "../../shared/adapters/http-client"

export const httpSession: SessionPort = {
  async restore() { try { return await request<Session>("/session") } catch { return null } },
  login(email, password, human) { return request<Session>("/session", json("POST", { email, password }, undefined, human)) },
  logout(csrf) { return request("/session", { method: "DELETE", headers: { "X-CSRF-Token": csrf } }) },
  changePassword(current, next, csrf) { return request("/me/password", json("PUT", { current, next }, csrf)) },
  async socialStart(provider) { return (await request<{ url: string }>(`/session/social/start?provider=${encodeURIComponent(provider)}`)).url },
}

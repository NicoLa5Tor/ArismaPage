import type { UsersPort } from "../application/users-port"
import { json, request, seg } from "../../shared/adapters/http-client"

export const httpUsers: UsersPort = {
  list() { return request("/users") },
  create(input, csrf) { return request("/users", json("POST", input, csrf)) },
  update(id, input, csrf) { return request(`/users/${seg(id)}`, json("PUT", input, csrf)) },
  resetPassword(id, csrf) { return request(`/users/${seg(id)}/password-reset`, { method: "POST", headers: { "X-CSRF-Token": csrf } }) },
  closeSessions(id, csrf) { return request(`/users/${seg(id)}/sessions`, { method: "DELETE", headers: { "X-CSRF-Token": csrf } }) },
}

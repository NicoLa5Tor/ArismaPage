import type { AccountPort } from "../application/account-port"
import type { Shopper, ShopperSession } from "../domain/account"
import { safeNext } from "../domain/account"
import { SESSION_LOST_EVENT, StoreError, storeJson, storeRequest } from "../../shared/adapters/store-client"

const SOCIAL_NOTE = "arisma.social"
const CHANNEL = "arisma-cuenta"
const STORAGE_PING = "arisma.cuenta.ping"

// Tabs hear each other through BroadcastChannel; browsers without it get the storage event instead.
function channel(): BroadcastChannel | null {
  try { return typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(CHANNEL) } catch { return null }
}

/** Which sign-in the shared /callback page is finishing: "shop" when the store left its note, else the panel. */
export function socialTarget(): "shop" | "admin" {
  try { return (JSON.parse(window.sessionStorage.getItem(SOCIAL_NOTE) ?? "null") as { target?: string } | null)?.target === "shop" ? "shop" : "admin" } catch { return "admin" }
}

export const httpAccount: AccountPort = {
  async restore() {
    try { return await storeRequest<ShopperSession>("/shop/session") }
    catch (error) { if (error instanceof StoreError && error.status === 401) return null; throw error }
  },
  login: (email, password, human) => storeRequest<ShopperSession>("/shop/session", storeJson("POST", { email, password }, undefined, human)),
  register: (name, email, password, acceptsPrivacy, human) => storeRequest<ShopperSession>("/shop/session/register", storeJson("POST", { name, email, password, acceptsPrivacy }, undefined, human)),
  async logout(csrf) { await storeRequest("/shop/session", { method: "DELETE", headers: { "X-CSRF-Token": csrf } }) },
  async socialStart(provider, next) {
    const url = (await storeRequest<{ url: string }>(`/shop/session/social/start?provider=${encodeURIComponent(provider)}`)).url
    // the shared /callback page reads this note to know the sign-in was for the store and where to go back
    try { window.sessionStorage.setItem(SOCIAL_NOTE, JSON.stringify({ target: "shop", next: safeNext(next) })) } catch { /* it falls back to the home */ }
    return url
  },
  async socialFinish(state, code) {
    let next = "/"
    try { const note = JSON.parse(window.sessionStorage.getItem(SOCIAL_NOTE) ?? "null") as { next?: string } | null; next = safeNext(note?.next); window.sessionStorage.removeItem(SOCIAL_NOTE) } catch { /* home */ }
    return { session: await storeRequest<ShopperSession>("/shop/session/social/callback", storeJson("POST", { state, code })), next }
  },

  rename: (name, csrf) => storeRequest<Shopper>("/shop/account/name", storeJson("PUT", { name }, csrf)),
  async changePassword(current, next, csrf) { await storeRequest("/shop/account/password", storeJson("PUT", { current, next }, csrf)) },
  async logoutEverywhere(csrf) { await storeRequest("/shop/account/logout-everywhere", { method: "POST", headers: { "X-CSRF-Token": csrf } }) },
  async exportData() {
    const data = await storeRequest<unknown>("/shop/account/export")
    return new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
  },
  async erase(password, confirm, csrf) { await storeRequest("/shop/account/erase", storeJson("POST", { password, confirm }, csrf)) },
  async requestVerification(csrf) { await storeRequest("/shop/account/verification", { method: "POST", headers: { "X-CSRF-Token": csrf } }) },
  async confirmEmail(token) { await storeRequest("/shop/session/verify", storeJson("POST", { token })) },
  async requestReset(email, human) { await storeRequest("/shop/session/reset-request", storeJson("POST", { email }, undefined, human)) },
  async resetPassword(token, password) { await storeRequest("/shop/session/reset", storeJson("POST", { token, password })) },

  announce() {
    const ch = channel()
    if (ch) { ch.postMessage("changed"); ch.close(); return }
    try { window.localStorage.setItem(STORAGE_PING, String(Date.now())) } catch { /* nothing else to tell */ }
  },
  onAnnounce(listener) {
    const ch = channel()
    if (ch) { ch.onmessage = () => listener(); return () => ch.close() }
    const onStorage = (event: StorageEvent) => { if (event.key === STORAGE_PING) listener() }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  },
  onSessionLost(listener) {
    window.addEventListener(SESSION_LOST_EVENT, listener)
    return () => window.removeEventListener(SESSION_LOST_EVENT, listener)
  },
}

"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import type { AccountPort } from "../application/account-port"
import type { Shopper, ShopperSession } from "../domain/account"
import { usePort } from "../../shared/ui/ports"

type Account = {
  /** null while signed out; `ready` says whether the browser already asked. */
  session: ShopperSession | null
  ready: boolean
  /** True for a moment after the session was found closed (expired or ended elsewhere), so the page can say so. */
  lost: boolean
  /** After signing in or out here: updates this tab and tells the others. */
  setSession: (session: ShopperSession | null) => void
  /** The account's data changed (name, verification): keeps the session, refreshes the shopper. */
  updateShopper: (shopper: Shopper) => void
  logout: () => Promise<void>
  /** Asks the store again who is signed in (after confirming the email, for example). */
  refresh: () => Promise<void>
}
const AccountContext = createContext<Account | null>(null)
const RECHECK_MS = 60_000

/**
 * The shopper's session for every store page. It is asked once per visit, again when the tab comes back after a while,
 * and whenever another tab signs in or out. When any account call finds the session gone, it is cleared here too.
 */
export function AccountProvider({ children }: { children: ReactNode }) {
  const port = usePort<AccountPort>("account")
  const [session, setCurrent] = useState<ShopperSession | null>(null)
  const [ready, setReady] = useState(false)
  const [lost, setLost] = useState(false)
  const checked = useRef(0)

  // only the store saying "not signed in" (401) signs the shopper out; a store restarting or a network blip is asked
  // again a few times (1, 2 and 4 seconds) before the page decides, so nobody looks signed out for a hiccup
  const refresh = useCallback(async () => {
    checked.current = Date.now()
    for (let attempt = 0; ; attempt++) {
      try { setCurrent(await port.restore()); break }
      catch { if (attempt >= 3) break; await new Promise((resolve) => window.setTimeout(resolve, 1000 * 2 ** attempt)) }
    }
    setReady(true)
  }, [port])

  useEffect(() => { void refresh() }, [refresh])
  useEffect(() => port.onAnnounce(() => { void refresh() }), [port, refresh])
  useEffect(() => port.onSessionLost(() => { setCurrent(null); setLost(true) }), [port])
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === "visible" && Date.now() - checked.current > RECHECK_MS) void refresh() }
    document.addEventListener("visibilitychange", onVisible)
    return () => document.removeEventListener("visibilitychange", onVisible)
  }, [refresh])
  useEffect(() => {
    if (!lost) return
    const timer = window.setTimeout(() => setLost(false), 8000)
    return () => window.clearTimeout(timer)
  }, [lost])

  const setSession = useCallback((next: ShopperSession | null) => { setCurrent(next); setLost(false); port.announce() }, [port])
  const updateShopper = useCallback((shopper: Shopper) => { setCurrent((current) => (current ? { ...current, shopper } : current)); port.announce() }, [port])
  const logout = useCallback(async () => {
    const current = session
    setCurrent(null)
    try { if (current) await port.logout(current.csrf) } catch { /* already closed on the server */ } finally { port.announce() }
  }, [port, session])

  const value = useMemo(() => ({ session, ready, lost, setSession, updateShopper, logout, refresh }), [session, ready, lost, setSession, updateShopper, logout, refresh])
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
}

export function useAccount(): Account {
  const account = useContext(AccountContext)
  if (!account) throw new Error("AccountProvider missing")
  return account
}
export const useAccountPort = () => usePort<AccountPort>("account")

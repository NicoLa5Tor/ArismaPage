"use client"

import { createContext, useContext, type ReactNode } from "react"
import type { Permission } from "../domain/permission"

/** Cross-module navigation: modules open each other's records without importing each other's screens. */
export type Navigation = {
  openOrder: (id: string) => void
  openCustomer: (id: string) => void
  openQuote: (id: string) => void
  /** Opens the product editor (from an order line, a quote, a ranking…). */
  openProduct: (id: string) => void
  /** Moves to a panel section with optional filters, e.g. go("orders", { estado: "processing" }). */
  go: (section: string, params?: Record<string, string>) => void
}
export type AdminSession = Navigation & {
  csrf: string
  /** Signed-in user; the backend enforces permissions, the panel uses them to hide what the user cannot do. */
  user: { id: string; name: string; email: string; roleLabel: string; permissions: Permission[] }
  openAccount: () => void
  /** Increments after any change so lists reload. */
  version: number
  changed: () => void
  notify: (message: string) => void
}
const SessionContext = createContext<AdminSession | null>(null)
const PortsContext = createContext<Record<string, unknown> | null>(null)

/** Composition root hands in the session and the adapters that implement each module's port. */
export function AdminProviders({ session, ports, children }: { session: AdminSession; ports: Record<string, unknown>; children: ReactNode }) {
  return <PortsContext.Provider value={ports}><SessionContext.Provider value={session}>{children}</SessionContext.Provider></PortsContext.Provider>
}
export function useSession() { const s = useContext(SessionContext); if (!s) throw new Error("AdminProviders missing"); return s }
/** Each module wraps this in a typed hook (useOrdersPort, useCatalogPort…). */
export function usePort<T>(key: string): T {
  const ports = useContext(PortsContext)
  if (!ports || !(key in ports)) throw new Error(`Port "${key}" not provided`)
  return ports[key] as T
}
/** Whether the signed-in user may do something. Hide or disable controls with it; the backend still checks. */
export function useCan() { const { user } = useSession(); return (p: Permission) => user.permissions.includes(p) }

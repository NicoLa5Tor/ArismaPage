"use client"

import { createContext, useContext, type ReactNode } from "react"

const PortsContext = createContext<Record<string, unknown> | null>(null)

/** The composition root (panel or store) hands in the adapter that implements each module's port. */
export function PortsProvider({ ports, children }: { ports: Record<string, unknown>; children: ReactNode }) {
  return <PortsContext.Provider value={ports}>{children}</PortsContext.Provider>
}
/** Each module wraps this in a typed hook (useCatalogPort, usePosts…). */
export function usePort<T>(key: string): T {
  const ports = useContext(PortsContext)
  if (!ports || !(key in ports)) throw new Error(`Port "${key}" not provided`)
  return ports[key] as T
}

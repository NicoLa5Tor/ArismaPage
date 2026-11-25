"use client"

import { createContext, useContext, useEffect } from "react"

/**
 * What a piece of content inside a tabbed box can tell the box: that it has nothing to show (its tab disappears) and
 * how many items it holds (shown next to the tab's name once known). Outside such a box both do nothing.
 */
export type InfoPanel = { hide: () => void; count: (n: number) => void }
export const InfoPanelContext = createContext<InfoPanel | null>(null)

/** Reports the panel empty while `empty` is true, and its item count when given. */
export function useInfoPanel({ empty, count }: { empty: boolean; count?: number }) {
  const panel = useContext(InfoPanelContext)
  useEffect(() => { if (empty) panel?.hide() }, [empty, panel])
  useEffect(() => { if (count != null) panel?.count(count) }, [count, panel])
  return panel !== null
}

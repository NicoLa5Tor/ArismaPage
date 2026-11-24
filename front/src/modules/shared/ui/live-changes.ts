"use client"

import { useEffect, useRef, useState } from "react"

/**
 * Listens to a Server-Sent Events address of the store and calls `onChange` when something changed (heartbeats are
 * ignored). Changes arriving together are coalesced into one call. If the connection drops it comes back with a
 * growing wait, and it is closed while the tab is hidden, so an idle tab costs the server nothing.
 */
export function useLiveChanges(url: string | null, onChange: (kind: string) => void): boolean {
  const [live, setLive] = useState(false)
  const callback = useRef(onChange)
  useEffect(() => { callback.current = onChange })
  useEffect(() => {
    if (!url || typeof EventSource === "undefined") return
    let source: EventSource | null = null, retry: number | undefined, coalesce: number | undefined, wait = 1_000, stopped = false
    const open = () => {
      if (stopped || document.visibilityState === "hidden") return
      source = new EventSource(url)
      source.onopen = () => { wait = 1_000; setLive(true) }
      source.onmessage = (event) => {
        let kind = "change"
        try { kind = (JSON.parse(event.data) as { kind?: string }).kind ?? "change" } catch { /* a bare message still means a change */ }
        if (kind === "heartbeat") return
        window.clearTimeout(coalesce)
        coalesce = window.setTimeout(() => callback.current(kind), 300)
      }
      source.onerror = () => {
        source?.close(); source = null; setLive(false)
        window.clearTimeout(retry)
        retry = window.setTimeout(open, wait)
        wait = Math.min(wait * 2, 60_000)
      }
    }
    const onVisibility = () => {
      if (document.visibilityState === "hidden") { source?.close(); source = null; setLive(false) }
      else if (!source) { callback.current("resume"); open() }
    }
    open()
    document.addEventListener("visibilitychange", onVisibility)
    return () => { stopped = true; source?.close(); window.clearTimeout(retry); window.clearTimeout(coalesce); document.removeEventListener("visibilitychange", onVisibility); setLive(false) }
  }, [url])
  return live
}

"use client"

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { useStoreProfile } from "./store-profile"

// Cloudflare Turnstile, loaded only on the forms that need it. With "interaction-only" most people never see it: the
// widget answers on its own and shows a box only when Cloudflare wants a click.

type Turnstile = {
  render(element: HTMLElement, options: Record<string, unknown>): string
  remove(id: string): void
}
declare global { interface Window { turnstile?: Turnstile } }

const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
let loading: Promise<Turnstile> | null = null

function loadTurnstile(): Promise<Turnstile> {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  loading ??= new Promise<Turnstile>((resolve, reject) => {
    const script = document.createElement("script")
    script.src = SCRIPT
    script.async = true
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("turnstile")))
    script.onerror = () => { loading = null; script.remove(); reject(new Error("turnstile")) }
    document.head.appendChild(script)
  })
  return loading
}

function Widget({ siteKey, action, onToken }: { siteKey: string; action: string; onToken: (token: string | null) => void }) {
  const box = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)
  const report = useRef(onToken)
  useEffect(() => { report.current = onToken })
  useEffect(() => {
    let id: string | null = null
    let alive = true
    loadTurnstile().then((turnstile) => {
      if (!alive || !box.current) return
      id = turnstile.render(box.current, {
        sitekey: siteKey, action, appearance: "interaction-only", language: "es", theme: "light",
        callback: (token: string) => { setFailed(false); report.current(token) },
        "expired-callback": () => report.current(null),
        "error-callback": () => { report.current(null); setFailed(true) },
      })
    }).catch(() => { if (alive) setFailed(true) })
    return () => { alive = false; if (id && window.turnstile) window.turnstile.remove(id) }
  }, [siteKey, action])
  return (
    <div className="human-check">
      <div ref={box} />
      {failed && <p className="human-check-error" role="alert">No pudimos cargar la verificación de seguridad. Revisa tu conexión o recarga la página.</p>}
    </div>
  )
}

/**
 * The challenge for one form. `token` goes with the request; `reset` asks for a new one after every attempt, since a
 * token works only once. When the store has no Turnstile key, nothing is shown and `ready` is always true.
 */
export function useHumanCheck(action: string): { needed: boolean; ready: boolean; token: string | undefined; widget: ReactNode; reset: () => void } {
  const siteKey = useStoreProfile().turnstileSiteKey
  const [token, setToken] = useState<string | null>(null)
  const [round, setRound] = useState(0)
  const reset = useCallback(() => { setToken(null); setRound((value) => value + 1) }, [])
  const needed = Boolean(siteKey)
  return {
    needed,
    ready: !needed || token !== null,
    token: token ?? undefined,
    widget: needed ? <Widget key={round} siteKey={siteKey} action={action} onToken={setToken} /> : null,
    reset,
  }
}

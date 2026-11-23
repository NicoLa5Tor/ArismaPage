"use client"

import { useEffect, useRef, useState } from "react"
import { httpAccount, socialTarget } from "../../modules/account/adapters/http-account"

// One callback address for both sign-ins (the one registered with the identity provider). The store leaves a note
// before leaving; without it this is a panel sign-in. The backend refuses an attempt started for one side and finished
// on the other, so the note only decides where to send the code.
export default function SocialCallback() {
  const [error, setError] = useState("")
  const [shop, setShop] = useState(false)
  const started = useRef(false)
  useEffect(() => {
    if (started.current) return
    started.current = true
    const params = new URLSearchParams(window.location.search)
    const code = params.get("code"), state = params.get("state")
    const forShop = socialTarget() === "shop"
    queueMicrotask(() => setShop(forShop))
    window.history.replaceState(null, "", "/callback")
    const fail = "No se pudo completar el acceso con tu cuenta social."
    if (!code || !state) { queueMicrotask(() => setError(fail)); return }
    if (forShop) {
      httpAccount.socialFinish(state, code).then(({ next }) => { httpAccount.announce(); window.location.replace(next) }).catch(e => setError(e instanceof Error ? e.message : fail))
      return
    }
    fetch("/api/arisma-admin/session/social/callback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, state }), cache: "no-store" })
      .then(async response => { if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error || fail) } window.location.replace("/admin") })
      .catch(e => setError(e instanceof Error ? e.message : fail))
  }, [])
  const back = shop ? "/cuenta" : "/admin"
  return <main className="glass-login-stage"><section className="glass-window glass-login"><h1>{shop ? "Tu cuenta" : "Acceso al panel"}</h1>{error ? <><p role="alert">{error}</p><a className="glass-chip mt-4" href={back}>Volver al inicio de sesión</a></> : <p role="status">Verificando tu cuenta...</p>}</section></main>
}

"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, type FormEvent } from "react"
import { CircleNotch, FacebookLogo, GoogleLogo, WarningCircle } from "@phosphor-icons/react"
import { type SocialProvider, emailError, nameError, passwordError, safeNext } from "../domain/account"
import { useAccount, useAccountPort } from "./account-context"
import { AccountHome } from "./account-home"
import { useStoreProfile } from "../../shared/ui/store-profile"
import { useHumanCheck } from "../../shared/ui/human-check"

type Mode = "login" | "register"

/** Sign in or open an account: email and password, or Google and Facebook. `next` is where the shopper was going. */
export function AccountPanel({ next, reason }: { next: string; reason?: string }) {
  const profile = useStoreProfile()
  const router = useRouter()
  const port = useAccountPort()
  const { session, ready, lost, setSession } = useAccount()
  const [mode, setMode] = useState<Mode>("login")
  const [name, setName] = useState(""), [email, setEmail] = useState(""), [password, setPassword] = useState("")
  const [busy, setBusy] = useState<"form" | SocialProvider | null>(null)
  const [error, setError] = useState(""), [touched, setTouched] = useState(false)
  const target = safeNext(next)
  const human = useHumanCheck(mode === "login" ? "login" : "registro")

  const problems = { name: mode === "register" ? nameError(name) : null, email: emailError(email), password: mode === "register" ? passwordError(password) : password ? null : "Escribe tu contraseña" }
  const shown = touched ? problems : { name: null, email: null, password: null }

  async function submit(event: FormEvent) {
    event.preventDefault(); setTouched(true); setError("")
    if (problems.name || problems.email || problems.password) return
    if (!human.ready) { setError("Estamos confirmando que eres una persona. Espera un momento y vuelve a intentarlo."); return }
    setBusy("form")
    try {
      setSession(mode === "login" ? await port.login(email.trim(), password, human.token) : await port.register(name.trim(), email.trim(), password, human.token))
      setPassword(""); setTouched(false)
      // straight back to where the shopper was; staying on /cuenta shows the account
      if (target !== "/" && target !== "/cuenta") router.replace(target)
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo completar. Inténtalo de nuevo.")
      human.reset()
    } finally { setBusy(null) }
  }
  async function social(provider: SocialProvider) {
    setError(""); setBusy(provider)
    try {
      const url = new URL(await port.socialStart(provider, target))
      // the identity provider's page; anything else would be a mistake worth stopping
      if (url.protocol !== "https:") throw new Error("No se pudo abrir el inicio de sesión.")
      window.location.assign(url.href)
    } catch (err) { setError(err instanceof Error ? err.message : "No se pudo abrir el inicio de sesión."); setBusy(null) }
  }

  if (!ready) return <div className="account-card squircle" aria-busy="true"><p className="account-wait"><CircleNotch className="spin" size={20} aria-hidden="true" /> Revisando tu sesión…</p></div>
  if (session) return <AccountHome next={target} />

  return (
    <div className="account-card squircle">
      {lost && <p className="store-alert" role="status"><WarningCircle size={18} weight="fill" aria-hidden="true" /> Tu sesión se cerró. Vuelve a entrar para continuar.</p>}
      <h1>{mode === "login" ? "Entra a tu cuenta" : "Crea tu cuenta"}</h1>
      <p className="account-lead">{reason ?? `Con tu cuenta calificas productos, haces preguntas, hablas con el asistente de ${profile.shortName} y sigues tus pedidos.`}</p>

      <div className="account-social">
        <button type="button" className="account-social-button squircle" onClick={() => void social("google")} disabled={busy !== null}>{busy === "google" ? <CircleNotch className="spin" size={20} aria-hidden="true" /> : <GoogleLogo size={20} weight="bold" aria-hidden="true" />} Continuar con Google</button>
        <button type="button" className="account-social-button squircle" onClick={() => void social("facebook")} disabled={busy !== null}>{busy === "facebook" ? <CircleNotch className="spin" size={20} aria-hidden="true" /> : <FacebookLogo size={20} weight="fill" aria-hidden="true" />} Continuar con Facebook</button>
      </div>
      <p className="account-divider"><span>o con tu correo</span></p>

      <form className="account-form" onSubmit={submit} noValidate>
        {mode === "register" && (
          <label className="store-field">Nombre
            <input type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={Boolean(shown.name)} maxLength={80} />
            {shown.name && <span className="store-field-error">{shown.name}</span>}
          </label>
        )}
        <label className="store-field">Correo
          <input type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={Boolean(shown.email)} />
          {shown.email && <span className="store-field-error">{shown.email}</span>}
        </label>
        <label className="store-field">Contraseña
          <input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={Boolean(shown.password)} />
          {shown.password ? <span className="store-field-error">{shown.password}</span> : mode === "register" ? <span className="store-field-hint">Mínimo 8 caracteres.</span> : null}
        </label>
        {mode === "login" && <Link href="/cuenta/recuperar" className="account-forgot">¿Olvidaste tu contraseña?</Link>}
        {human.widget}
        {error && <p className="store-alert" role="alert">{error}</p>}
        <button type="submit" className="button-primary account-submit" disabled={busy !== null}>{busy === "form" ? <><CircleNotch className="spin" size={18} aria-hidden="true" /> Un momento…</> : mode === "login" ? "Entrar" : "Crear cuenta"}</button>
      </form>

      <p className="account-switch">
        {mode === "login" ? "¿Primera vez aquí?" : "¿Ya tienes cuenta?"}{" "}
        <button type="button" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); setTouched(false) }}>{mode === "login" ? "Crea tu cuenta" : "Entra"}</button>
      </p>
    </div>
  )
}

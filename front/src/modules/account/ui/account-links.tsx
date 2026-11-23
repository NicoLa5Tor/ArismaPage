"use client"

import Link from "next/link"
import { useEffect, useRef, useState, type FormEvent } from "react"
import { CheckCircle, CircleNotch, WarningCircle } from "@phosphor-icons/react"
import { emailError, passwordError } from "../domain/account"
import { useAccount, useAccountPort } from "./account-context"
import { useStoreProfile } from "../../shared/ui/store-profile"
import { useHumanCheck } from "../../shared/ui/human-check"

const message = (e: unknown) => (e instanceof Error ? e.message : "No se pudo completar. Inténtalo de nuevo.")

/** "¿Olvidaste tu contraseña?": asks for the email and always answers the same, whether it has an account or not. */
export function ResetRequest() {
  const profile = useStoreProfile()
  const port = useAccountPort()
  const [email, setEmail] = useState(""), [busy, setBusy] = useState(false), [sent, setSent] = useState(false), [error, setError] = useState("")
  const human = useHumanCheck("recuperar")
  async function submit(event: FormEvent) {
    event.preventDefault(); setError("")
    const problem = emailError(email)
    if (problem) { setError(problem); return }
    if (!human.ready) { setError("Estamos confirmando que eres una persona. Espera un momento y vuelve a intentarlo."); return }
    setBusy(true)
    try { await port.requestReset(email.trim(), human.token); setSent(true) } catch (e) { setError(message(e)); human.reset() } finally { setBusy(false) }
  }
  return (
    <div className="account-card squircle">
      <h1>Recupera tu cuenta</h1>
      {sent ? <>
        <p className="account-ok" role="status"><CheckCircle size={20} weight="fill" aria-hidden="true" /> Si ese correo tiene una cuenta en {profile.shortName}, te llegará un enlace para elegir una contraseña nueva. Vence en una hora.</p>
        <p className="account-note">¿No llega? Revisa la carpeta de correo no deseado o entra con Google o Facebook usando el mismo correo.</p>
        <Link href="/cuenta" className="link-arrow">Volver a entrar</Link>
      </> : <form className="account-form" onSubmit={submit} noValidate>
        <p className="account-lead">Escribe el correo de tu cuenta y te enviamos un enlace para elegir una contraseña nueva.</p>
        <label className="store-field">Correo<input type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={Boolean(error)} /></label>
        {human.widget}
        {error && <p className="store-field-error" role="alert">{error}</p>}
        <button type="submit" className="button-primary account-submit" disabled={busy}>{busy ? <><CircleNotch className="spin" size={18} aria-hidden="true" /> Enviando…</> : "Enviarme el enlace"}</button>
        <Link href="/cuenta" className="account-forgot">Volver a entrar</Link>
      </form>}
    </div>
  )
}

/** The link from the email: choose the new password. Every session closes, so the shopper signs in again with it. */
export function ResetPassword({ token }: { token: string }) {
  const port = useAccountPort()
  const { setSession } = useAccount()
  const [password, setPassword] = useState(""), [busy, setBusy] = useState(false), [done, setDone] = useState(false), [error, setError] = useState("")
  async function submit(event: FormEvent) {
    event.preventDefault(); setError("")
    const problem = passwordError(password)
    if (problem) { setError(problem); return }
    setBusy(true)
    try { await port.resetPassword(token, password); setSession(null); setDone(true) } catch (e) { setError(message(e)) } finally { setBusy(false) }
  }
  if (!token) return <div className="account-card squircle"><h1>Enlace incompleto</h1><p className="account-lead">Abre el enlace completo del correo o pide uno nuevo.</p><Link href="/cuenta/recuperar" className="link-arrow">Pedir otro enlace</Link></div>
  return (
    <div className="account-card squircle">
      <h1>Elige una contraseña nueva</h1>
      {done ? <>
        <p className="account-ok" role="status"><CheckCircle size={20} weight="fill" aria-hidden="true" /> Listo. Tu correo quedó confirmado y cerramos las sesiones abiertas.</p>
        <Link href="/cuenta" className="button-primary">Entrar con la contraseña nueva</Link>
      </> : <form className="account-form" onSubmit={submit} noValidate>
        <label className="store-field">Contraseña nueva<input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={Boolean(error)} /><span className="store-field-hint">Mínimo 8 caracteres.</span></label>
        {error && <p className="store-alert" role="alert">{error} {error.includes("venció") && <Link href="/cuenta/recuperar">Pedir otro enlace</Link>}</p>}
        <button type="submit" className="button-primary account-submit" disabled={busy}>{busy ? <><CircleNotch className="spin" size={18} aria-hidden="true" /> Guardando…</> : "Guardar contraseña"}</button>
      </form>}
    </div>
  )
}

/** The link from the email that confirms the address. It runs once, when the page opens. */
export function VerifyEmail({ token }: { token: string }) {
  const port = useAccountPort()
  const { refresh } = useAccount()
  const [state, setState] = useState<"busy" | "done" | "error">(token ? "busy" : "error"), [error, setError] = useState(token ? "" : "Abre el enlace completo del correo.")
  const started = useRef(false)
  useEffect(() => {
    if (!token || started.current) return
    started.current = true
    port.confirmEmail(token).then(async () => { await refresh(); setState("done") }).catch((e) => { setError(message(e)); setState("error") })
  }, [port, token, refresh])
  return (
    <div className="account-card squircle" aria-busy={state === "busy"}>
      <h1>Confirmar tu correo</h1>
      {state === "busy" && <p className="account-wait"><CircleNotch className="spin" size={20} aria-hidden="true" /> Confirmando…</p>}
      {state === "done" && <><p className="account-ok" role="status"><CheckCircle size={20} weight="fill" aria-hidden="true" /> Tu correo quedó confirmado. Ya ves todos tus pedidos con este correo.</p><Link href="/cuenta" className="button-primary">Ir a mi cuenta</Link></>}
      {state === "error" && <><p className="store-alert" role="alert"><WarningCircle size={18} weight="fill" aria-hidden="true" /> {error}</p><Link href="/cuenta" className="link-arrow">Ir a mi cuenta y pedir otro enlace</Link></>}
    </div>
  )
}

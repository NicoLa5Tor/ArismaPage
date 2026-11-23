"use client"

import Image from "next/image"
import { GoogleLogo, FacebookLogo } from "@phosphor-icons/react"
import { useState, type FormEvent, type ReactNode } from "react"
import { BRAND_ICON, SOCIAL_LOGIN_ORIGIN } from "../../shared/domain/brand-assets"
import { useStoreProfile } from "../../shared/ui/store-profile"

type Props = { onSocialStart: (provider: "google" | "facebook") => Promise<string>; ready: boolean; busy: boolean; email: string; password: string; error: string; onEmailChange: (value: string) => void; onPasswordChange: (value: string) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; humanCheck?: ReactNode }

export function AdminLogin({ onSocialStart, ready, busy, email, password, error, onEmailChange, onPasswordChange, onSubmit, humanCheck }: Props) {
  const profile = useStoreProfile()
  const [showPassword, setShowPassword] = useState(false)
  const [socialError, setSocialError] = useState("")
  const [socialBusy, setSocialBusy] = useState(false)
  async function socialLogin(provider: "google" | "facebook") {
    setSocialBusy(true); setSocialError("")
    try {
      const destination = new URL(await onSocialStart(provider))
      if (destination.origin !== SOCIAL_LOGIN_ORIGIN) throw new Error("No se pudo iniciar el acceso social.")
      window.location.assign(destination.href)
    } catch (err) { setSocialError(err instanceof Error ? err.message : "No se pudo iniciar el acceso social."); setSocialBusy(false) }
  }
  return <main id="contenido" className="glass-login-stage"><div className="glass-env" aria-hidden="true"><div className="glass-env-photo" /><div className="glass-env-veil" /></div><section className="glass-window glass-login" aria-labelledby="login-title">
    <div className="glass-login-brand"><Image src={BRAND_ICON} alt="" width={56} height={56} /><div><strong>{profile.shortName}</strong><span>Panel de administración</span></div></div>
    <h1 id="login-title">Bienvenido de nuevo</h1><p>Ingresa a tu espacio de administración.</p>
    {!ready ? <div className="glass-login-loading" role="status" aria-label="Preparando inicio de sesión"><i /><i /><i /></div> : <form onSubmit={onSubmit} className="glass-login-form">
      {error && <p role="alert" className="glass-alert">{error}</p>}
      <label>Correo electrónico<input type="email" value={email} onChange={e => onEmailChange(e.target.value)} required autoComplete="username" placeholder="nombre@empresa.com" /></label>
      <label>Contraseña<span className="glass-password"><input type={showPassword ? "text" : "password"} value={password} onChange={e => onPasswordChange(e.target.value)} required autoComplete="current-password" placeholder="Tu contraseña" /><button type="button" aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? "Ocultar" : "Mostrar"}</button></span></label>
      {humanCheck}
      <button className="glass-cta" disabled={busy}>{busy ? "Ingresando…" : "Ingresar al panel"}<span aria-hidden="true">→</span></button>
    </form>}
    {ready && <div className="social-login"><span>O ingresa con</span>{socialError && <p role="alert" className="glass-alert">{socialError}</p>}<div className="social-login-options"><button type="button" className="glass-chip" disabled={socialBusy || busy} onClick={() => void socialLogin("google")}><GoogleLogo size={19} weight="bold" aria-hidden="true" />Google</button><button type="button" className="glass-chip" disabled={socialBusy || busy} onClick={() => void socialLogin("facebook")}><FacebookLogo size={19} weight="fill" aria-hidden="true" />Facebook</button></div></div>}
    <p className="glass-login-help">¿Necesitas acceso? Contacta a la persona encargada de tu cuenta.</p>
  </section></main>
}

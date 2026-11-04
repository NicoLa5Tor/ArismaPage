"use client"

import Image from "next/image"
import { useState, type FormEvent } from "react"

type Props = { ready: boolean; busy: boolean; email: string; password: string; error: string; onEmailChange: (value: string) => void; onPasswordChange: (value: string) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }

export function AdminLogin({ ready, busy, email, password, error, onEmailChange, onPasswordChange, onSubmit }: Props) {
  const [showPassword, setShowPassword] = useState(false)
  return <main id="contenido" className="glass-login-stage"><div className="glass-env" aria-hidden="true"><div className="glass-env-photo" /><div className="glass-env-veil" /></div><section className="glass-window glass-login" aria-labelledby="login-title">
    <div className="glass-login-brand"><Image src="/brand/favicon-arisma.png" alt="" width={56} height={56} /><div><strong>Arisma</strong><span>Panel de administración</span></div></div>
    <h1 id="login-title">Bienvenido de nuevo</h1><p>Ingresa a tu espacio de administración.</p>
    {!ready ? <div className="glass-login-loading" role="status" aria-label="Preparando inicio de sesión"><i /><i /><i /></div> : <form onSubmit={onSubmit} className="glass-login-form">
      {error && <p role="alert" className="glass-alert">{error}</p>}
      <label>Correo electrónico<input type="email" value={email} onChange={e => onEmailChange(e.target.value)} required autoComplete="username" placeholder="nombre@empresa.com" /></label>
      <label>Contraseña<span className="glass-password"><input type={showPassword ? "text" : "password"} value={password} onChange={e => onPasswordChange(e.target.value)} required autoComplete="current-password" placeholder="Tu contraseña" /><button type="button" aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? "Ocultar" : "Mostrar"}</button></span></label>
      <button className="glass-cta" disabled={busy}>{busy ? "Ingresando…" : "Ingresar al panel"}<span aria-hidden="true">→</span></button>
    </form>}
    <p className="glass-login-help">¿Necesitas acceso? Contacta a la persona encargada de tu cuenta.</p>
  </section></main>
}

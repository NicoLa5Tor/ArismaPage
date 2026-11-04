"use client"

import { useState, type FormEvent } from "react"
import { Check, Circle } from "@phosphor-icons/react"
import { passwordProblems } from "../domain/users"

/** Current + new + confirmation, with the password rules ticking as the user types. */
export function PasswordForm({ email, submitLabel, onSubmit, currentLabel = "Contraseña actual" }: { email: string; submitLabel: string; currentLabel?: string; onSubmit: (current: string, next: string) => Promise<void> }) {
  const [current, setCurrent] = useState(""), [next, setNext] = useState(""), [confirm, setConfirm] = useState("")
  const [show, setShow] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(""), [tried, setTried] = useState(false)
  const problems = passwordProblems(next, email)
  const rules = [{ text: "Al menos 12 caracteres", ok: next.length >= 12 }, { text: "Variada, sin repetir un solo carácter", ok: next.length > 0 && new Set(next).size >= 4 }, { text: "Sin tu usuario de correo", ok: next.length > 0 && !problems.includes("Que no contenga tu usuario de correo") }, { text: "Las dos contraseñas coinciden", ok: next.length > 0 && next === confirm }]
  async function submit(e: FormEvent) {
    e.preventDefault(); setTried(true); setError("")
    if (problems.length || next !== confirm || !current) return
    setBusy(true)
    try { await onSubmit(current, next) } catch (err) { setError(err instanceof Error ? err.message : "No se pudo cambiar la contraseña") } finally { setBusy(false) }
  }
  const type = show ? "text" : "password"
  return <form onSubmit={submit} className="grid gap-4" noValidate>
    {error && <p role="alert" className="glass-alert">{error}</p>}
    <label className="glass-label">{currentLabel}<input className="glass-field" type={type} autoComplete="current-password" value={current} aria-invalid={tried && !current} onChange={e => setCurrent(e.target.value)} /></label>
    <label className="glass-label">Nueva contraseña<input className="glass-field" type={type} autoComplete="new-password" value={next} onChange={e => setNext(e.target.value)} placeholder="Una frase que recuerdes, ej. tablero verde en la tienda" /></label>
    <label className="glass-label">Repite la nueva contraseña<input className="glass-field" type={type} autoComplete="new-password" value={confirm} aria-invalid={tried && next !== confirm} onChange={e => setConfirm(e.target.value)} /></label>
    <ul className="glass-checklist" aria-label="Requisitos de la contraseña">{rules.map(r => <li key={r.text} data-ok={r.ok || undefined}>{r.ok ? <Check size={14} aria-hidden="true" /> : <Circle size={14} aria-hidden="true" />}{r.text}<span className="sr-only">{r.ok ? ": cumplido" : ": pendiente"}</span></li>)}</ul>
    <label className="glass-check py-2"><input type="checkbox" checked={show} onChange={e => setShow(e.target.checked)} />Mostrar contraseñas</label>
    <button className="glass-cta" disabled={busy}>{busy ? "Guardando…" : submitLabel}</button>
  </form>
}

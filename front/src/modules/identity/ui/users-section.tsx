"use client"

import { useState, type FormEvent } from "react"
import { Key, LockKey, Plus, ShieldCheck, SignOut, UserCircle, UsersThree, WarningCircle } from "@phosphor-icons/react"
import { ROLES, type PanelUser, type Role } from "../domain/users"
import type { WithPassword } from "../application/users-port"
import { date, dateTime, plural } from "../../shared/ui/format"
import { Async, Badge, Card, Dialog, useLoad } from "../../shared/ui/parts"
import { Avatar, CopyButton, Panel, Row, Segmented, Switch } from "../../shared/ui/rich"
import { DataTable, type Column } from "../../shared/ui/data-table"
import { useSession } from "../../shared/ui/admin-context"
import { useUsersPort } from "./use-users"

const roleLabel = (r: Role) => ROLES.find(x => x.value === r)?.label ?? r
function stateOf(u: PanelUser): { text: string; tone: "good" | "warn" | "bad" | "neutral" } {
  if (!u.active) return { text: "Desactivado", tone: "neutral" }
  if (u.locked) return { text: "Bloqueado por intentos", tone: "bad" }
  if (u.mustChangePassword) return { text: "Debe crear su contraseña", tone: "warn" }
  return { text: "Activo", tone: "good" }
}
const COLUMNS: Column<PanelUser>[] = [
  { key: "name", label: "Usuario", primary: true, render: u => <span className="flex min-w-0 items-center gap-4"><Avatar name={u.name} size={36} /><span className="min-w-0"><span className="block truncate">{u.name}</span><span className="block truncate text-xs font-normal muted">{u.email}</span></span></span> },
  { key: "role", label: "Rol", render: u => <Badge tone={u.role === "admin" ? "info" : "neutral"}>{roleLabel(u.role)}</Badge> },
  { key: "state", label: "Estado", render: u => { const s = stateOf(u); return <Badge tone={s.tone}>{s.text}</Badge> } },
  { key: "last", label: "Último ingreso", render: u => <span className="muted whitespace-nowrap">{u.lastLoginAt ? dateTime(u.lastLoginAt) : "Nunca"}</span> },
  { key: "sessions", label: "Sesiones abiertas", numeric: true, desktopOnly: true, render: u => u.openSessions },
]

/** Shows a temporary password once, with copy and a reminder of how to share it. */
function TemporaryPassword({ result }: { result: WithPassword }) {
  return <div className="glass-secret" role="status">
    <p className="font-semibold"><Key size={16} aria-hidden="true" className="mr-2 inline" />Contraseña temporal de {result.user.name}</p>
    <div className="glass-secret-value"><code>{result.temporaryPassword}</code><CopyButton value={result.temporaryPassword} label="contraseña temporal" /></div>
    <p className="text-xs">Compártela por un canal privado (en persona o por WhatsApp directo). Solo se muestra esta vez; al entrar, {result.user.name.split(" ")[0]} deberá crear su propia contraseña.</p>
  </div>
}

function UserDialog({ user, onClose, onSaved }: { user: PanelUser | null; onClose: () => void; onSaved: () => void }) {
  const api = useUsersPort()
  const { csrf, notify, user: me } = useSession()
  const [form, setForm] = useState({ email: user?.email ?? "", name: user?.name ?? "", role: user?.role ?? "seller" as Role, active: user?.active ?? true })
  const [current, setCurrent] = useState(user)
  const [secret, setSecret] = useState<WithPassword | null>(null)
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [confirmReset, setConfirmReset] = useState(false)
  const self = user?.id === me.id
  const dirty = !user ? !!(form.email || form.name) : form.name !== user.name || form.role !== user.role || form.active !== user.active
  async function run<T>(action: () => Promise<T>, done: (r: T) => void) {
    setBusy(true); setError("")
    try { done(await action()); onSaved() } catch (e) { setError(e instanceof Error ? e.message : "No se pudo completar la acción") } finally { setBusy(false) }
  }
  function save(e: FormEvent) {
    e.preventDefault()
    if (!current) void run(() => api.create({ email: form.email, name: form.name, role: form.role }, csrf), r => { setSecret(r); setCurrent(r.user); notify(`Usuario ${r.user.name} creado.`) })
    else void run(() => api.update(current.id, { name: form.name, role: form.role, active: form.active }, csrf), u => { setCurrent(u); notify("Usuario actualizado."); onClose() })
  }
  const footer = secret ? <div className="glass-dialog-actions"><span /><button type="button" className="glass-cta" onClick={onClose}>Listo, ya la copié</button></div>
    : <div className="glass-dialog-actions"><span className="text-sm text-stone-500">{dirty ? "Cambios sin guardar" : ""}</span><span className="flex gap-2"><button type="button" className="glass-chip" disabled={busy} onClick={onClose}>Cancelar</button><button type="submit" form="user-form" className="glass-cta" disabled={busy || (!!current && !dirty)}>{busy ? "Guardando…" : current ? "Guardar cambios" : "Crear usuario"}</button></span></div>
  return <Dialog eyebrow={current ? "Usuario" : "Nuevo usuario"} title={current ? current.name : "Invitar a alguien al panel"} busy={busy} onClose={onClose} footer={footer}
    confirmClose={dirty && !secret ? "Tienes cambios sin guardar." : null}
    media={current ? <Avatar name={current.name} size={52} /> : <span className="glass-panel-icon"><UserCircle size={24} aria-hidden="true" /></span>}
    meta={current ? <><Badge tone={stateOf(current).tone}>{stateOf(current).text}</Badge><span>{current.email}</span>{self && <span>Eres tú</span>}</> : undefined}>
    <div className="grid gap-6">
      {error && <p role="alert" className="glass-alert"><WarningCircle size={16} aria-hidden="true" />{error}</p>}
      {secret ? <TemporaryPassword result={secret} /> : <form id="user-form" onSubmit={save} className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="glass-label">Nombre<input className="glass-field" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ej. Laura Gómez" autoFocus={!current} /></label>
          <label className="glass-label">Correo<input className="glass-field" type="email" required disabled={!!current} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="laura@tutienda.com" /></label>
        </div>
        <div className="grid gap-2"><span className="text-sm font-semibold">Rol</span>
          <Segmented label="Rol" value={form.role} onChange={v => setForm({ ...form, role: v })} options={ROLES.map(r => ({ value: r.value, label: r.label, icon: r.value === "admin" ? ShieldCheck : UserCircle }))} />
          <p className="text-xs text-stone-500">{ROLES.find(r => r.value === form.role)?.description}</p>
          {self && <p className="text-xs text-stone-500">No puedes quitarte el rol de administrador a ti mismo.</p>}</div>
        {current && <Switch title="Cuenta activa" hint={self ? "No puedes desactivar tu propia cuenta." : "Desactivarla cierra sus sesiones y le impide entrar; su historial se conserva."} checked={form.active} disabled={self} onChange={v => setForm({ ...form, active: v })} />}
        {!current && <p className="text-sm text-stone-500">Al crear el usuario verás una contraseña temporal para compartirle. Deberá cambiarla en su primer ingreso.</p>}
      </form>}
      {current && !secret && <Panel icon={LockKey} title="Acceso">
        <dl className="glass-rows"><Row label="Último ingreso">{current.lastLoginAt ? dateTime(current.lastLoginAt) : "Nunca ha entrado"}</Row><Row label="Sesiones">{plural(current.openSessions, "sesión abierta", "sesiones abiertas")}</Row><Row label="Creado">{date(current.createdAt)}{current.createdByName && ` por ${current.createdByName}`}</Row></dl>
        <div className="flex flex-wrap gap-2">
          {confirmReset ? <span className="glass-confirm-inline" role="alertdialog" aria-label="Confirmar restablecimiento"><span>Se cerrarán sus sesiones y tendrá que crear otra contraseña.</span><button type="button" className="glass-chip glass-chip-danger" disabled={busy} onClick={() => void run(() => api.resetPassword(current.id, csrf), r => { setSecret(r); setConfirmReset(false) })}>Restablecer</button><button type="button" className="glass-chip" onClick={() => setConfirmReset(false)}>No</button></span>
            : <button type="button" className="glass-chip" disabled={busy} onClick={() => setConfirmReset(true)}><Key size={16} aria-hidden="true" />{current.locked ? "Desbloquear y restablecer contraseña" : "Restablecer contraseña"}</button>}
          {!self && current.openSessions > 0 && <button type="button" className="glass-chip" disabled={busy} onClick={() => void run(() => api.closeSessions(current.id, csrf), () => { setCurrent({ ...current, openSessions: 0 }); notify(`Sesiones de ${current.name} cerradas.`) })}><SignOut size={16} aria-hidden="true" />Cerrar sus sesiones</button>}
        </div>
      </Panel>}
    </div>
  </Dialog>
}

export function UsersSection() {
  const api = useUsersPort()
  const { version, changed } = useSession()
  const users = useLoad(() => api.list(), [version])
  const [open, setOpen] = useState<PanelUser | null | undefined>(undefined)
  const admins = users.data?.filter(u => u.role === "admin" && u.active).length ?? 0
  return <div className="glass-scroll">
    <Card icon={UsersThree} title="Equipo del panel" subtitle={users.data ? `${plural(users.data.filter(u => u.active).length, "persona activa", "personas activas")} · ${plural(admins, "administrador", "administradores")}` : undefined}
      actions={<button type="button" className="glass-cta" onClick={() => setOpen(null)}><Plus size={16} aria-hidden="true" />Nuevo usuario</button>}>
      <div className="mt-4"><Async state={users} label="Cargando usuarios" empty={{ icon: UsersThree, title: "Aún no hay usuarios", when: d => d.length === 0 }}>{d => <DataTable caption="Usuarios del panel" rows={d} columns={COLUMNS} onOpen={u => setOpen(u)} />}</Async></div>
    </Card>
    <div className="glass-panels">{ROLES.map(r => <Panel key={r.value} icon={r.value === "admin" ? ShieldCheck : UserCircle} title={r.label}><p className="text-sm text-stone-500">{r.description}</p></Panel>)}</div>
    {open !== undefined && <UserDialog key={open?.id ?? "new"} user={open} onClose={() => setOpen(undefined)} onSaved={() => { users.reload(); changed() }} />}
  </div>
}

"use client"

import Image from "next/image"
import { SignOut } from "@phosphor-icons/react"
import type { CurrentUser } from "../domain/users"
import { Dialog } from "../../shared/ui/parts"
import { Avatar, Panel, Row } from "../../shared/ui/rich"
import { ShieldCheck, Key } from "@phosphor-icons/react"
import { PasswordForm } from "./password-form"
import { BRAND_ICON } from "../../shared/domain/brand-assets"

/** First sign-in with a temporary password: the panel stays closed until the user picks their own. */
export function ForcedPasswordChange({ user, onChange, onLogout }: { user: CurrentUser; onChange: (current: string, next: string) => Promise<void>; onLogout: () => void }) {
  return <main id="contenido" className="glass-login-stage"><div className="glass-env" aria-hidden="true"><div className="glass-env-photo" /><div className="glass-env-veil" /></div>
    <section className="glass-window glass-login password-change" aria-labelledby="change-title">
      <div className="glass-login-brand"><Image src={BRAND_ICON} alt="" width={56} height={56} /><div><strong>Hola, {user.name.split(" ")[0]}</strong><span>{user.roleLabel} · {user.email}</span></div></div>
      <h1 id="change-title">Crea tu contraseña</h1><p>Entraste con una contraseña temporal. Elige una propia para continuar; solo tú la conocerás.</p>
      <PasswordForm email={user.email} currentLabel="Contraseña temporal" submitLabel="Guardar y entrar al panel" onSubmit={onChange} />
      <button type="button" className="glass-chip password-logout" onClick={onLogout}><SignOut size={16} aria-hidden="true" />Salir</button>
    </section></main>
}

export function AccountDialog({ user, onClose, onChange, onLogout }: { user: CurrentUser; onClose: () => void; onChange: (current: string, next: string) => Promise<void>; onLogout: () => void }) {
  return <Dialog eyebrow="Mi cuenta" title={user.name} media={<Avatar name={user.name} size={52} />} meta={<><span>{user.roleLabel}</span><span>{user.email}</span></>} onClose={onClose}
    footer={<div className="glass-dialog-actions"><span /><button type="button" className="glass-chip" onClick={onLogout}><SignOut size={16} aria-hidden="true" />Cerrar sesión</button></div>}>
    <div className="glass-panels">
      <Panel icon={ShieldCheck} title="Tu acceso"><dl className="glass-rows"><Row label="Rol">{user.roleLabel}</Row><Row label="Puedes">{user.role === "admin" ? "Todo el panel, incluidos usuarios, precios e impuestos." : "Pedidos, cotizaciones, clientes y consultar el catálogo."}</Row></dl></Panel>
      <Panel icon={Key} title="Cambiar contraseña"><PasswordForm email={user.email} submitLabel="Cambiar contraseña" onSubmit={onChange} /></Panel>
    </div>
  </Dialog>
}

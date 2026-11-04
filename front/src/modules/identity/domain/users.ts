import type { Permission } from "../../shared/domain/permission"

export type Role = "admin" | "seller"
export const ROLES: { value: Role; label: string; description: string }[] = [
  { value: "seller", label: "Vendedor", description: "Atiende pedidos, cotizaciones y clientes. No cambia productos, precios, impuestos, cupones ni usuarios." },
  { value: "admin", label: "Administrador", description: "Todo lo del vendedor, más catálogo, precios, impuestos, cupones y usuarios." },
]
/** The signed-in user, as the session returns it. */
export type CurrentUser = { id: string; name: string; email: string; role: Role; roleLabel: string; permissions: Permission[]; mustChangePassword: boolean }
export type PanelUser = { id: string; email: string; name: string; role: Role; active: boolean; mustChangePassword: boolean; lastLoginAt: string | null; locked: boolean | null; createdAt: string; createdByName: string | null; openSessions: number }
/** Same rule as back/.../identity/domain/PasswordPolicy.java, checked as the user types. */
export function passwordProblems(password: string, email: string): string[] {
  const local = email.split("@")[0]?.toLowerCase() ?? ""
  const problems: string[] = []
  if (password.length < 12) problems.push("Al menos 12 caracteres")
  if (new Set(password).size < 4) problems.push("No repitas el mismo carácter")
  if (local.length >= 4 && password.toLowerCase().includes(local)) problems.push("Que no contenga tu usuario de correo")
  return problems
}

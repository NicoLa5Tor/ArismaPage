// The shopper's store account.

export type Shopper = { id: string; name: string; email: string; emailVerified: boolean }
export type ShopperSession = { csrf: string; shopper: Shopper }
export type SocialProvider = "google" | "facebook"

export const MIN_PASSWORD = 8

const EMAIL = /^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]{2,}$/

export function emailError(email: string): string | null {
  return EMAIL.test(email.trim()) ? null : "Escribe un correo válido, como nombre@correo.com"
}
export function passwordError(password: string): string | null {
  if (password.length < MIN_PASSWORD) return `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres`
  if (new Set(password).size < 4) return "La contraseña es demasiado repetitiva"
  return null
}
export function nameError(name: string): string | null {
  return name.trim().length >= 2 ? null : "Escribe tu nombre"
}

/** Where to go after signing in: only paths inside the store, never another site. */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\") || next.startsWith("/admin") || next.startsWith("/api")) return "/"
  return next
}
export const loginUrl = (next: string) => `/cuenta?volver=${encodeURIComponent(next)}`

export const firstName = (name: string) => name.trim().split(/\s+/)[0] || "Cliente"

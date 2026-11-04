// Presentation formatting for Colombian pesos, counts and Bogotá dates.
const cop = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 })
export const money = (value: number | string | null | undefined) => value == null || value === "" ? "Sin precio" : cop.format(Number(value))
/** Compact pesos for tight spaces: $ 24,6 M, $ 820 mil. */
export function moneyShort(value: number) {
  if (Math.abs(value) >= 1e6) return `$ ${(value / 1e6).toLocaleString("es-CO", { maximumFractionDigits: 1 })} M`
  if (Math.abs(value) >= 1e3) return `$ ${Math.round(value / 1e3).toLocaleString("es-CO")} mil`
  return cop.format(value)
}
export const count = (value: number) => Number(value).toLocaleString("es-CO")
/** "1 pedido" / "3 pedidos". */
export const plural = (n: number, one: string, many: string) => `${count(n)} ${n === 1 ? one : many}`
const TZ = "America/Bogota"
export const date = (iso: string | null | undefined) => iso ? new Date(iso).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric", timeZone: TZ }) : "—"
export const dateTime = (iso: string | null | undefined) => iso ? new Date(iso).toLocaleString("es-CO", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: TZ }) : "—"
export const time = (iso: string | null | undefined) => iso ? new Date(iso).toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit", timeZone: TZ }) : ""
/** Today in Bogotá as YYYY-MM-DD. */
export const today = () => new Date().toLocaleDateString("en-CA", { timeZone: TZ })
export const shiftDay = (iso: string, days: number) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10) }
/** Percentage change against a previous value; null when there is nothing to compare. */
export const change = (current: number, previous: number): number | null => previous ? Math.round((current - previous) / previous * 1000) / 10 : null

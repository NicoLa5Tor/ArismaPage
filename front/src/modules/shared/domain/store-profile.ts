// Who the store is, as the backend keeps it (settings, "Perfil de la tienda"). Every front reads it from there, so a
// new store needs no change in the shared pages: only its own home and its logo files.
import { LEGAL_PATHS, type LegalKind } from "./legal"

export type StoreProfile = {
  /** shortName is how people call the store in a sentence ("Pregúntale a Arisma"). */
  name: string; shortName: string; legalName: string; taxId: string
  address: string; addressDetail: string; localCity: string; localState: string
  /** Digits with the country code (573001234567); whatsappLabel is how people read it. */
  whatsapp: string; whatsappLabel: string; phone: string; email: string
  hours: string[]; site: string; termsUrl: string; privacyUrl: string
  /** Brand colour, #rrggbb. */
  color: string
  /** Address, detail and city in one line; empty when the store has no address yet. */
  pickupLine: string
  /** Delivery terms, pesos with tax included: free local delivery from freeFromLocal (null: never), smallest order. */
  shipping: { localRate: number; nationalRate: number; freeFromLocal: number | null; pickup: boolean; minimumOrder: number }
  /** Which legal pages the store published itself and shows on its own addresses. */
  legal: Record<LegalKind, boolean>
  /** Shoppers may cancel their order on their own while it has not left. */
  shopperCancels: boolean
  /** The method shoppers pay with right now (wompi, payu, manual); null when the store takes no payments. */
  payment: { code: string; label: string } | null
  /** Cloudflare Turnstile's public key; empty when the store does not ask for the challenge on sign-in. */
  turnstileSiteKey: string
}

/** What the pages show while the backend cannot be reached: neutral, never another store's data. */
export const EMPTY_PROFILE: StoreProfile = {
  name: "Tienda", shortName: "la tienda", legalName: "", taxId: "", address: "", addressDetail: "", localCity: "", localState: "",
  whatsapp: "", whatsappLabel: "", phone: "", email: "", hours: [], site: "", termsUrl: "", privacyUrl: "", color: "#1d1a23", pickupLine: "",
  shipping: { localRate: 0, nationalRate: 0, freeFromLocal: null, pickup: false, minimumOrder: 0 },
  legal: { terms: false, privacy: false, returns: false, shipping: false }, shopperCancels: false, payment: null, turnstileSiteKey: "",
}

/** Where a legal page is read: the store's own page when it wrote one, else the address in its profile; undefined when it has neither. */
export function legalHref(profile: Pick<StoreProfile, "legal" | "termsUrl" | "privacyUrl">, kind: LegalKind): string | undefined {
  if (profile.legal?.[kind]) return LEGAL_PATHS[kind]
  if (kind === "terms") return profile.termsUrl || undefined
  if (kind === "privacy") return profile.privacyUrl || undefined
  return undefined
}

/** A WhatsApp chat with the store, with the first message written; undefined when the store has no WhatsApp. */
export function whatsappLink(profile: Pick<StoreProfile, "whatsapp">, message: string): string | undefined {
  return profile.whatsapp ? `https://wa.me/${profile.whatsapp}?text=${encodeURIComponent(message)}` : undefined
}
const simple = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
/** Whether a delivery pays the local rate: same department as the store, or a city that reads like the store's. Mirrors StoreProfile.isLocal in the backend. */
export function isLocal(profile: Pick<StoreProfile, "localCity" | "localState">, city: string, state: string): boolean {
  if (profile.localState && profile.localState === state.trim().toUpperCase()) return true
  const mine = simple(profile.localCity)
  return mine !== "" && simple(city).includes(mine)
}
/** "Envío en Medellín", or a neutral word when the store has no local area. */
export const localArea = (profile: Pick<StoreProfile, "localCity">) => profile.localCity || "tu ciudad"

const pesos = (value: number) => `$${Math.round(value).toLocaleString("es-CO")}`
/** How delivery works, in one sentence, from the store's real rates: never a promise the checkout does not keep. */
export function shippingSentence(profile: Pick<StoreProfile, "shipping" | "localCity">): string {
  const s = profile.shipping, area = profile.localCity || "la zona local"
  const local = s.freeFromLocal != null ? `En ${area} el envío es gratis en compras desde ${pesos(s.freeFromLocal)}; si no, cuesta ${pesos(s.localRate)}.` : `En ${area} el envío cuesta ${pesos(s.localRate)}.`
  return `Despachamos a todo el país. ${local} Al resto de Colombia, ${pesos(s.nationalRate)}.`
}
/** Short version for a badge: the free delivery threshold, else the national reach. */
export function shippingBadge(profile: Pick<StoreProfile, "shipping" | "localCity">): string {
  const s = profile.shipping
  return s.freeFromLocal != null ? `Envío gratis en ${profile.localCity || "la zona local"} desde ${pesos(s.freeFromLocal)}` : "Envíos a toda Colombia"
}
/** The ways to pay the active method offers, as shoppers know them. Empty when the store takes no payments. */
export function paymentMethods(profile: Pick<StoreProfile, "payment">): string[] {
  switch (profile.payment?.code) {
    case "wompi": return ["Tarjeta", "PSE", "Nequi", "Bancolombia"]
    case "payu": return ["Tarjeta", "PSE", "Efectivo"]
    case "manual": return ["Transferencia"]
    default: return []
  }
}
export function paymentSentence(profile: Pick<StoreProfile, "payment">): string {
  switch (profile.payment?.code) {
    case "wompi": return "Con tarjeta de crédito o débito, PSE, Nequi o botón Bancolombia, a través de Wompi."
    case "payu": return "Con tarjeta de crédito o débito, PSE o en efectivo, a través de PayU."
    case "manual": return "Por transferencia: al hacer el pedido te enviamos los datos para pagar."
    default: return "Escríbenos por WhatsApp y te ayudamos a completar la compra."
  }
}
/** The minimum order, as a sentence; empty when there is none. */
export function minimumSentence(profile: Pick<StoreProfile, "shipping">): string {
  return profile.shipping.minimumOrder > 0 ? `La compra mínima por la página es de ${pesos(profile.shipping.minimumOrder)}.` : ""
}

/**
 * Search engines may index the store only at its own address: the site its profile gives, served at that same address
 * (NORPRESS_PUBLIC_URL). A copy anywhere else (a beta, a test server) or a store whose address is not set stays out.
 */
export function indexable(profile: Pick<StoreProfile, "site">, publicUrl = process.env.NORPRESS_PUBLIC_URL): boolean {
  if (!profile.site || !publicUrl) return false
  try { return new URL(profile.site).origin === new URL(publicUrl).origin } catch { return false }
}

/** What a page asks of search engines, kept out of them wherever the store is not at its own address. */
export function robotsFor(profile: Pick<StoreProfile, "site">, wanted: { index: boolean; follow: boolean }) {
  return indexable(profile) ? wanted : { index: false, follow: false }
}

/** The store's public address without the final slash: its profile, else the server's NORPRESS_PUBLIC_URL. */
export function siteUrl(profile: Pick<StoreProfile, "site">): string {
  const site = profile.site || process.env.NORPRESS_PUBLIC_URL || "http://localhost:8000"
  return site.replace(/\/+$/, "")
}

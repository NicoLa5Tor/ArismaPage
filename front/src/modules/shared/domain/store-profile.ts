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
  /** Which legal pages the store wrote itself and shows on its own addresses. */
  legal: Record<LegalKind, boolean>
  /** Cloudflare Turnstile's public key; empty when the store does not ask for the challenge on sign-in. */
  turnstileSiteKey: string
}

/** What the pages show while the backend cannot be reached: neutral, never another store's data. */
export const EMPTY_PROFILE: StoreProfile = {
  name: "Tienda", shortName: "la tienda", legalName: "", taxId: "", address: "", addressDetail: "", localCity: "", localState: "",
  whatsapp: "", whatsappLabel: "", phone: "", email: "", hours: [], site: "", termsUrl: "", privacyUrl: "", color: "#1d1a23", pickupLine: "",
  shipping: { localRate: 0, nationalRate: 0, freeFromLocal: null, pickup: false, minimumOrder: 0 },
  legal: { terms: false, privacy: false }, turnstileSiteKey: "",
}

/** Where a legal page is read: the store's own page when it wrote one, else the address in its profile; undefined when it has neither. */
export function legalHref(profile: Pick<StoreProfile, "legal" | "termsUrl" | "privacyUrl">, kind: LegalKind): string | undefined {
  if (profile.legal?.[kind]) return LEGAL_PATHS[kind]
  return (kind === "terms" ? profile.termsUrl : profile.privacyUrl) || undefined
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

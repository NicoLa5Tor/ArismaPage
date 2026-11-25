// What the administrator configures for the public store. Mirrors back/.../settings/domain.
import type { StoreProfile } from "../../shared/domain/store-profile"

/** The store profile as the administrator edits it (what the backend works out from it is left out). */
export type Profile = Omit<StoreProfile, "whatsappLabel" | "pickupLine" | "shipping" | "legal" | "shopperCancels" | "payment" | "turnstileSiteKey">

export type Conversations = { reviews: boolean; questions: boolean; manualModeration: boolean; buyersOnly: boolean; customerReplies: boolean }
/** Pesos with tax included. localRate is for the store's city (its profile); freeFromLocal null: local delivery is never free. */
export type Shipping = { localRate: number; nationalRate: number; freeFromLocal: number | null; pickup: boolean; minimumOrder: number }
/** shopperCancels: the shopper may cancel on their own before the order leaves (a paid one is refunded right away). */
export type CheckoutRules = { unpaidHours: number; shopperCancels: boolean }
export type GatewayCode = "wompi" | "payu" | "manual"
export type Environment = "test" | "live"
/** `secrets` never carries a secret: for each one, "" when it is not stored or dots with its last characters. */
export type Credentials = { complete: boolean; config: Record<string, string>; secrets: Record<string, string> }
/** environments is false for the transfer: its instructions are the same in tests and in production (kept as live). */
export type Gateway = { code: GatewayCode; label: string; environments: boolean; publicFields: string[]; secretFields: string[]; test: Credentials | null; live: Credentials }
/** active is "" while no method is set; ready says shoppers can pay right now. */
export type Payments = { active: GatewayCode | ""; mode: Environment; ready: boolean; gateways: Gateway[] }
export type CredentialsChange = { config: Record<string, string>; secrets: Record<string, string> }
export type StoreSettings = { store: Profile; conversations: Conversations; shipping: Shipping; checkout: CheckoutRules; productPage: Record<string, string>; payments: Payments }

export type MailSecurity = "STARTTLS" | "SSL" | "NONE"
export type Mail = { host: string; port: number; security: MailSecurity; username: string; fromAddress: string; fromName: string; storeInbox: string }
export type MailView = { settings: Mail; passwordStored: boolean }
export type OutboxItem = { id: string; kind: string; recipient: string; subject: string; bodyHtml: string; status: "stored" | "pending" | "sent" | "failed"; attempts: number; lastError: string | null; createdAt: string; sentAt: string | null }
export type Outbox = { items: OutboxItem[]; total: number }

/** Credentials of a method in one environment (the transfer has only one set). */
export const credentialsOf = (gateway: Gateway, environment: Environment): Credentials => (gateway.environments && environment === "test" ? gateway.test ?? gateway.live : gateway.live)

/** Words for each credential field, and where the administrator finds it. */
export const fieldText: Record<string, { label: string; hint: string }> = {
  publicKey: { label: "Llave pública", hint: "Empieza por pub_test_ en pruebas y pub_prod_ en producción. Está en Desarrolladores, en tu panel de Wompi." },
  privateKey: { label: "Llave privada", hint: "Empieza por prv_test_ o prv_prod_. Sirve para confirmar el pago cuando el cliente vuelve a la tienda." },
  integritySecret: { label: "Secreto de integridad", hint: "Empieza por test_integrity_ o prod_integrity_. Firma el valor de cada cobro." },
  eventsSecret: { label: "Secreto de eventos", hint: "Empieza por test_events_ o prod_events_. Comprueba los avisos de pago que envía Wompi." },
  merchantId: { label: "ID del comercio (merchantId)", hint: "En Configuración técnica, en tu panel de PayU. En pruebas, PayU publica el 508029." },
  accountId: { label: "ID de la cuenta (accountId)", hint: "El de la cuenta de Colombia. En pruebas, PayU publica el 512321." },
  apiKey: { label: "API Key", hint: "Firma los cobros y comprueba las confirmaciones de PayU." },
  apiLogin: { label: "API Login (opcional)", hint: "Está junto a la API Key, en Configuración técnica de PayU. Con ella la tienda devuelve el dinero de las cancelaciones por PayU; sin ella, esos reembolsos se hacen por transferencia." },
  instructions: { label: "Instrucciones de pago", hint: "Lo que lee el cliente al terminar su pedido: banco, cuenta, titular y a dónde enviar el comprobante." },
}

export const gatewayNotes: Record<GatewayCode, string> = {
  wompi: "En Wompi, pon como URL de eventos la dirección de tu tienda seguida de /api/pagos/wompi (una para pruebas y otra para producción).",
  payu: "La tienda le envía a PayU la dirección de confirmación en cada cobro; no hay que configurarla en su panel.",
  manual: "El pedido queda sin pagar hasta que registres el pago en Pedidos.",
}

export const mailPresets: { name: string; host: string; port: number; security: MailSecurity; hint: string }[] = [
  { name: "Brevo", host: "smtp-relay.brevo.com", port: 587, security: "STARTTLS", hint: "Usuario y clave SMTP están en Brevo, en SMTP y API." },
  { name: "Google Workspace", host: "smtp.gmail.com", port: 587, security: "STARTTLS", hint: "Usa una contraseña de aplicación de la cuenta remitente." },
  { name: "Amazon SES", host: "email-smtp.us-east-1.amazonaws.com", port: 587, security: "STARTTLS", hint: "Cambia la región si tu cuenta de SES está en otra." },
]

export function shippingError(s: Shipping): string | null {
  const bad = (n: number | null) => n !== null && (!Number.isFinite(n) || n < 0)
  if (bad(s.localRate) || bad(s.nationalRate) || bad(s.freeFromLocal) || bad(s.minimumOrder)) return "Escribe los valores en pesos, sin puntos ni signos"
  return null
}

/** What the profile form checks before saving; the backend checks the same and has the last word. */
export function profileError(p: Profile): string | null {
  if (!p.name.trim()) return "Escribe el nombre de la tienda"
  if (p.whatsapp && p.whatsapp.replace(/\D/g, "").length < 10) return "Escribe el WhatsApp con el indicativo del país, por ejemplo 573001234567"
  for (const url of [p.site, p.termsUrl, p.privacyUrl]) if (url && !/^https?:\/\//.test(url)) return "Los enlaces deben empezar por https://"
  if (!/^#[0-9a-fA-F]{6}$/.test(p.color)) return "El color va en formato #rrggbb"
  return null
}

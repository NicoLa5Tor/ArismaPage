// Carriers and tracking stages. Mirrors back/.../fulfillment/domain/Carrier.java and TrackingStage.java.

/** A carrier as the store keeps it (Tienda → Envíos). Mirrors back/.../fulfillment/domain/Carrier.java. */
export type CarrierInfo = {
  code: string; name: string; aliases: string[]; trackingKey: number | null
  /** The carrier's page with {guia} where the number goes; null when its page does not take the number in the address. */
  linkTemplate: string | null; pageUrl: string | null; numberHint: string; active: boolean; position: number
}
export const NUMBER_SLOT = "{guia}"

/** Where the shopper follows a guide: straight to it when the page takes the number, else the carrier's tracking page. */
export function linkFor(carrier: Pick<CarrierInfo, "linkTemplate" | "pageUrl">, number: string): string | null {
  if (carrier.linkTemplate && number.trim()) return carrier.linkTemplate.replace(NUMBER_SLOT, encodeURIComponent(number.trim()))
  return carrier.pageUrl
}

/** A guide number as carriers print it: letters, digits and dashes, no spaces, in capitals (same rule as the store). */
export const normalizeNumber = (raw: string) => raw.replace(/\s+/g, "").toUpperCase()
export function numberError(raw: string): string | null {
  const n = normalizeNumber(raw)
  if (!n) return "Escribe el número de guía"
  if (n.length < 4 || n.length > 40 || !/^[A-Z0-9-]+$/.test(n)) return "El número de guía lleva de 4 a 40 letras, números o guiones"
  return null
}

export type TrackingStage = "waiting" | "received" | "in_transit" | "pickup_ready" | "out_for_delivery" | "attempt_failed" | "delivered" | "exception" | "expired"
export type TrackingEvent = { at: string; description: string; location: string }

export const trackingStages: Record<TrackingStage, { label: string; text: string; tone: "good" | "info" | "warn" | "bad" }> = {
  waiting: { label: "Esperando a la transportadora", text: "La transportadora aún no publica movimientos de esta guía.", tone: "info" },
  received: { label: "Recibido por la transportadora", text: "La transportadora registró tu envío.", tone: "info" },
  in_transit: { label: "En tránsito", text: "Tu paquete va camino a tu ciudad.", tone: "info" },
  pickup_ready: { label: "Listo para recoger", text: "Tu paquete te espera en una oficina de la transportadora.", tone: "warn" },
  out_for_delivery: { label: "En reparto", text: "El mensajero ya salió a entregarlo.", tone: "info" },
  attempt_failed: { label: "Intento de entrega fallido", text: "La transportadora intentó entregarlo y no pudo.", tone: "warn" },
  delivered: { label: "Entregado", text: "La transportadora confirmó la entrega.", tone: "good" },
  exception: { label: "Con novedad", text: "La transportadora reporta una novedad con el envío.", tone: "bad" },
  expired: { label: "Sin movimientos recientes", text: "La transportadora no ha publicado movimientos en mucho tiempo.", tone: "warn" },
}
/** The steps a shopper reads, in order; the current one is where the carrier says it is. */
export const TRACKING_STEPS: { id: TrackingStage; label: string }[] = [
  { id: "received", label: "Recibido" }, { id: "in_transit", label: "En tránsito" }, { id: "out_for_delivery", label: "En reparto" }, { id: "delivered", label: "Entregado" },
]
export function stepIndex(stage: TrackingStage): number {
  if (stage === "pickup_ready" || stage === "attempt_failed") return 2
  if (stage === "exception" || stage === "expired") return 1
  return TRACKING_STEPS.findIndex(s => s.id === stage)
}

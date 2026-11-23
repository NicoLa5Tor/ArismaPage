// Carriers and tracking stages. Mirrors back/.../fulfillment/domain/Carrier.java and TrackingStage.java.

export type Carrier = { id: string; label: string; trackingPage: string; names: string[] }

/** None of these pages takes the guide in its address: the shopper types it there, so we always show it next to the link. */
export const CARRIER_LIST: Carrier[] = [
  { id: "inter", label: "Inter Rapidísimo", trackingPage: "https://www.interrapidisimo.com/", names: ["inter", "interrapidisimo", "inter rapidisimo"] },
  { id: "coordinadora", label: "Coordinadora", trackingPage: "https://coordinadora.com/rastreo/rastreo-de-guia/", names: ["coordinadora"] },
  { id: "servientrega", label: "Servientrega", trackingPage: "https://www.servientrega.com/wps/portal/rastreo-envio", names: ["servientrega"] },
  { id: "envia", label: "Envía", trackingPage: "https://envia.co/", names: ["envia", "envia colvanes", "colvanes"] },
  { id: "tcc", label: "TCC", trackingPage: "https://tcc.com.co/", names: ["tcc"] },
  { id: "deprisa", label: "Deprisa", trackingPage: "https://www.deprisa.com/", names: ["deprisa"] },
  { id: "postal", label: "4-72", trackingPage: "https://www.4-72.com.co/", names: ["472", "4 72", "servicios postales nacionales"] },
]

const simple = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()

/** "Interrapidísimo", "INTER RAPIDISIMO" and "inter" are the same carrier; unknown names give null. */
export function matchCarrier(typed: string | null | undefined): Carrier | null {
  if (!typed?.trim()) return null
  const key = simple(typed)
  return CARRIER_LIST.find(c => c.names.some(n => simple(n) === key)) ?? null
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

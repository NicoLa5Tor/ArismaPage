import type { DeliveryMethod } from "../../fulfillment/domain/fulfillment"
import type { OrderStage } from "../domain/stage"
import { Badge, type Tone } from "../../shared/ui/parts"

export const STAGE: Record<OrderStage, { label: string; hint: string; tone: Tone }> = {
  unpaid: { label: "Sin pagar", hint: "Esperando el pago del cliente", tone: "neutral" },
  to_prepare: { label: "Por preparar", hint: "Pagados, hay que alistarlos", tone: "warn" },
  packed: { label: "Empacado", hint: "Listos para enviar o recoger", tone: "info" },
  shipped: { label: "En camino", hint: "Con la transportadora o el mensajero", tone: "info" },
  to_invoice: { label: "Por facturar", hint: "Entregados, falta enviar la factura", tone: "warn" },
  delivered: { label: "Finalizado", hint: "Entregados y facturados", tone: "good" },
  issue: { label: "Requiere atención", hint: "En espera, no entregados o devueltos", tone: "bad" },
  cancelled: { label: "Cancelado", hint: "Cancelados, fallidos o reembolsados", tone: "neutral" },
}
export const stageLabel = (s: OrderStage, m?: DeliveryMethod | null) => s === "packed" && m === "pickup" ? "Listo para recoger" : STAGE[s].label
export const StageBadge = ({ stage, method }: { stage: OrderStage; method?: DeliveryMethod | null }) => <Badge tone={STAGE[stage].tone}>{stageLabel(stage, method)}</Badge>

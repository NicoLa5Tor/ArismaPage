import { Storefront, Truck, Moped, type Icon } from "@phosphor-icons/react"
import type { DeliveryMethod, DeliveryStatus } from "../domain/fulfillment"
import { Badge, type Tone } from "../../shared/ui/parts"

export const DELIVERY_STATUS: Record<DeliveryStatus, string> = { pending: "Por preparar", packed: "Empacado", shipped: "En camino", delivered: "Entregado", failed: "No entregado", returned: "Devuelto", cancelled: "Sin envío" }
/** Pickup reads differently: "Listo para recoger" instead of "Empacado". */
export const statusLabel = (s: DeliveryStatus, m: DeliveryMethod) => s === "packed" && m === "pickup" ? "Listo para recoger" : DELIVERY_STATUS[s]
export const STEP_ACTION: Record<DeliveryStatus, (m: DeliveryMethod) => string> = {
  pending: () => "Volver a por preparar", packed: m => m === "pickup" ? "Listo para recoger" : "Marcar empacado", shipped: m => m === "courier" ? "Salió con el mensajero" : "Enviar con guía",
  delivered: () => "Marcar entregado", failed: () => "No se entregó", returned: () => "Marcar devuelto", cancelled: () => "Sin envío",
}
export const METHOD: Record<DeliveryMethod, { label: string; icon: Icon }> = { carrier: { label: "Transportadora", icon: Truck }, courier: { label: "Mensajero propio", icon: Moped }, pickup: { label: "Recoger en tienda", icon: Storefront } }
const TONE: Record<DeliveryStatus, Tone> = { pending: "warn", packed: "info", shipped: "info", delivered: "good", failed: "bad", returned: "neutral", cancelled: "neutral" }
export const DeliveryBadge = ({ status, method }: { status: DeliveryStatus; method?: DeliveryMethod }) => <Badge tone={TONE[status]}>{method ? statusLabel(status, method) : DELIVERY_STATUS[status]}</Badge>
export const MethodLabel = ({ method }: { method: DeliveryMethod }) => { const M = METHOD[method]; return <span className="inline-flex items-center gap-2"><M.icon size={14} aria-hidden="true" />{M.label}</span> }

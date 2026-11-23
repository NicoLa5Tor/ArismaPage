import type { OrderStatus } from "../domain/orders"
import { Badge, type Tone } from "../../shared/ui/parts"

export const ORDER_STATUS: Record<OrderStatus, string> = { pending: "Pendiente de pago", on_hold: "En espera", processing: "Procesando", completed: "Completado", cancelled: "Cancelado", failed: "Fallido", refunded: "Reembolsado" }
export const PAYMENT: Record<string, string> = { payulatam: "PayU", payu: "PayU", wompi: "Wompi", manual: "Transferencia o acuerdo", cod: "Contra entrega", sin_metodo: "Sin método" }
/** Status actions get explicit wording. */
export const ACTION: Record<OrderStatus, string> = { completed: "Marcar completado", processing: "Pasar a procesando", on_hold: "Poner en espera", cancelled: "Cancelar pedido", refunded: "Marcar reembolsado", failed: "Marcar fallido", pending: "Volver a pendiente" }
const TONE: Record<OrderStatus, Tone> = { pending: "warn", on_hold: "warn", processing: "info", completed: "good", cancelled: "neutral", failed: "bad", refunded: "neutral" }
export const OrderBadge = ({ status }: { status: OrderStatus }) => <Badge tone={TONE[status]}>{ORDER_STATUS[status]}</Badge>

import type { QuoteStatus } from "../domain/quotes"
import { Badge, type Tone } from "../../shared/ui/parts"

export const QUOTE_STATUS: Record<QuoteStatus, string> = { pending: "Pendiente", accepted: "Aceptada", rejected: "Rechazada", expired: "Vencida", converted: "Convertida en pedido" }
const TONE: Record<QuoteStatus, Tone> = { pending: "warn", accepted: "info", rejected: "neutral", expired: "neutral", converted: "good" }
/** A pending quote past its expiry date reads as expired. */
export const QuoteBadge = ({ status, overdue }: { status: QuoteStatus; overdue?: boolean }) => overdue ? <Badge tone="neutral">Vencida</Badge> : <Badge tone={TONE[status]}>{QUOTE_STATUS[status]}</Badge>

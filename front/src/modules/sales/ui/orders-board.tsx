"use client"

import { useState } from "react"
import { CaretDown, CheckCircle, Phone } from "@phosphor-icons/react"
import type { Board, BoardCard } from "../../fulfillment/domain/fulfillment"
import { WORK_STAGES, type OrderStage } from "../domain/stage"
import type { OrderStatus } from "../domain/orders"
import { count, money, plural } from "../../shared/ui/format"
import { Badge } from "../../shared/ui/parts"
import { Thumb } from "../../shared/ui/rich"
import { useSession } from "../../shared/ui/admin-context"
import { MethodLabel } from "../../fulfillment/ui/labels"
import { FlowActions } from "./flow-actions"
import { STAGE } from "./stage"

/** "hoy", "hace 3 días", "hace 2 meses". */
export function age(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  return days < 1 ? "hoy" : days < 31 ? `hace ${plural(days, "día", "días")}` : days < 365 ? `hace ${plural(Math.floor(days / 30), "mes", "meses")}` : `hace ${plural(Math.floor(days / 365), "año", "años")}`
}

function Card({ card }: { card: BoardCard }) {
  const { openOrder } = useSession()
  return <li className="glass-dispatch-card" data-clickable onClick={() => openOrder(card.orderId)}>
    <button type="button" className="glass-dispatch-open" onClick={e => { e.stopPropagation(); openOrder(card.orderId) }} aria-label={`Abrir pedido #${card.number}`}>
      <span className="board-card-heading"><strong>#{card.number}</strong><span>{age(card.placedAt)}</span></span>
      <span className="board-card-customer"><Thumb image={card} size={40} /><span className="min-w-0"><strong className="block truncate">{card.customerName ?? "Sin nombre"}</strong><span className="board-card-muted block truncate">{card.city ?? "Sin ciudad"} · {plural(card.units, "unidad", "unidades")}</span></span></span>
      <span className="board-card-total"><span>Total</span><strong>{money(card.total)}</strong></span>
    </button>
    <div className="board-card-meta"><MethodLabel method={card.method} />
      {card.paymentMethod === "cod" && !card.paid && <Badge tone="warn">Contra entrega</Badge>}
      {card.orderStatus === "on_hold" && <Badge tone="bad">En espera</Badge>}
      {card.trackingCode && <span className="board-card-muted">{card.carrier} · {card.trackingCode}</span>}{card.courier && <span className="board-card-muted">Lleva {card.courier}</span>}</div>
    {card.failureReason && <p className="text-xs text-red-200">No se entregó: {card.failureReason}</p>}
    <div className="board-card-actions">
      <FlowActions target={{ orderId: card.orderId, number: card.number, stage: card.stage, orderStatus: card.orderStatus as OrderStatus, deliveryStatus: card.status, deliveryMethod: card.method, paymentMethod: card.paymentMethod, carrier: card.carrier, trackingCode: card.trackingCode }} />
      {card.phone && <a className="glass-icon-button ml-auto" href={`tel:${card.phone.replace(/[^\d+]/g, "")}`} onClick={e => e.stopPropagation()} aria-label={`Llamar a ${card.customerName ?? "el cliente"}`}><Phone size={16} aria-hidden="true" /></a>}
    </div>
  </li>
}

/** Work stages as columns, oldest order first: what the team has to move today. */
export function OrdersBoard({ board, onShowAll }: { board: Board; onShowAll: (stage: OrderStage) => void }) {
  const [expanded, setExpanded] = useState<OrderStage | null>("to_prepare")
  return <div className="orders-board-accordion">{WORK_STAGES.map(stage => {
    const cards = board.cards.filter(c => c.stage === stage), total = board.counts[stage] ?? 0
    const isOpen = expanded === stage
    return <section key={stage} className="board-stage" data-stage={stage}>
      <h3><button type="button" className="board-stage-toggle" aria-expanded={isOpen} aria-controls={`board-panel-${stage}`} onClick={() => setExpanded(isOpen ? null : stage)}>
        <span className="board-stage-title"><i aria-hidden="true" /><span>{STAGE[stage].label}<small>{STAGE[stage].hint}</small></span></span>
        <span className="board-stage-end"><span className="glass-preset-count">{count(total)}</span><CaretDown size={16} className="board-stage-chevron" aria-hidden="true" /></span>
      </button></h3>
      <div id={`board-panel-${stage}`} className="board-stage-content" hidden={!isOpen}>
        {cards.length === 0 ? <p className="glass-board-empty"><CheckCircle size={20} aria-hidden="true" />Nada pendiente aquí</p> : <ul className="board-cards">{cards.map(card => <Card key={card.orderId} card={card} />)}</ul>}
        {total > cards.length && <button type="button" className="glass-chip" onClick={() => onShowAll(stage)}>Ver los {count(total)} en la lista</button>}
      </div>
    </section>
  })}</div>
}

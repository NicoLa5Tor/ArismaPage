"use client"

import type { OrderRow } from "../domain/orders"
import { date, money, time } from "../../shared/ui/format"
import { METHOD } from "../../fulfillment/ui/labels"
import { FlowActions } from "./flow-actions"
import { PAYMENT } from "./labels"
import { StageBadge } from "./stage"

type Selection = { selected: Set<string>; onToggle: (id: string) => void; onToggleAll: () => void }

/**
 * Orders as rows built for the work: who, where it is, how much and the next step, always in that order. A wide panel
 * shows one line per order; a narrow one stacks the same row in three short lines, never as label and value pairs.
 * The whole row opens the order; the checkbox and the step buttons do their own thing.
 */
/** `history`: past orders are only looked at here; the steps are run from the order (after bringing it back). */
export function OrdersList({ rows, onOpen, selection, history = false }: { rows: OrderRow[]; onOpen: (row: OrderRow) => void; selection?: Selection; history?: boolean }) {
  const allSelected = !!selection && rows.length > 0 && rows.every(r => selection.selected.has(r.id))
  return <div className="orders-list" data-select={selection ? "" : undefined} role="region" aria-label="Pedidos">
    <div className="orders-list-head" aria-hidden="true">
      {selection && <span />}<span>Pedido</span><span>Cliente</span><span>Etapa</span><span className="num">Total</span><span>{history ? "" : "Siguiente paso"}</span>
    </div>
    {selection && <label className="orders-list-all"><input type="checkbox" checked={allSelected} onChange={selection.onToggleAll} /> Seleccionar los de esta página</label>}
    <ul>{rows.map(o => {
      const M = METHOD[o.deliveryMethod]
      const checked = selection?.selected.has(o.id) ?? false
      return <li key={o.id} className="orders-row" data-selected={checked || undefined} onClick={() => onOpen(o)}>
        {selection && <span className="orders-row-check" onClick={e => e.stopPropagation()}><input type="checkbox" aria-label={`Seleccionar pedido #${o.number}`} checked={checked} onChange={() => selection.onToggle(o.id)} /></span>}
        <button type="button" className="orders-row-id" onClick={e => { e.stopPropagation(); onOpen(o) }} aria-label={`Abrir pedido #${o.number}`}>
          <strong>#{o.number}</strong><span title={`${date(o.placedAt)} · ${time(o.placedAt)}`}>{date(o.placedAt)}</span>
        </button>
        <span className="orders-row-customer"><strong>{o.customerName ?? "Sin nombre"}</strong><span>{[o.city, o.paymentMethod ? PAYMENT[o.paymentMethod] ?? o.paymentMethodTitle : null].filter(Boolean).join(" · ") || o.customerEmail || ""}</span></span>
        <span className="orders-row-stage"><StageBadge stage={o.stage} method={o.deliveryMethod} /><span><M.icon size={14} aria-hidden="true" />{o.trackingCode ?? M.label}</span></span>
        <strong className="orders-row-total">{money(o.total)}</strong>
        <span className="orders-row-next">{!history && <FlowActions target={{ orderId: o.id, number: o.number, stage: o.stage, orderStatus: o.status, deliveryStatus: o.deliveryStatus, deliveryMethod: o.deliveryMethod, paymentMethod: o.paymentMethod, trackingCode: o.trackingCode }} />}</span>
      </li>
    })}</ul>
  </div>
}

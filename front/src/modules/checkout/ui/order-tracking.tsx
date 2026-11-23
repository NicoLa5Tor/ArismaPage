"use client"

import { useState } from "react"
import { ArrowSquareOut, Check, Copy } from "@phosphor-icons/react"
import { TRACKING_STEPS, matchCarrier, stepIndex, trackingStages } from "../../shared/domain/carriers"
import type { OrderView } from "../domain/checkout"

const dates = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota" })
const FIRST = 4

/**
 * The guide of a carrier shipment: where the carrier says it is (when the store follows it), its movements, and the
 * carrier's own page. Carrier pages do not take the guide in their address, so the number sits next to the link
 * with a button to copy it.
 */
export function OrderTracking({ order }: { order: OrderView }) {
  const [copied, setCopied] = useState(false), [all, setAll] = useState(false)
  if (!order.trackingCode) return null
  const carrier = matchCarrier(order.carrier)
  const tracking = order.tracking
  const stage = tracking?.stage ? trackingStages[tracking.stage] : null
  const current = tracking?.stage ? stepIndex(tracking.stage) : -1
  const events = tracking?.events ?? []
  async function copy() {
    try { await navigator.clipboard.writeText(order.trackingCode ?? ""); setCopied(true); window.setTimeout(() => setCopied(false), 2000) } catch { setCopied(false) }
  }
  return (
    <div className="order-tracking">
      {stage && <>
        <p className="order-fact"><strong>{stage.label}.</strong> {stage.text}</p>
        <ol className="tracking-steps" aria-label="Recorrido del envío">
          {TRACKING_STEPS.map((step, i) => <li key={step.id} data-done={i <= current} aria-current={i === current ? "step" : undefined}>{step.label}</li>)}
        </ol>
      </>}
      <div className="tracking-guide">
        <span><small>Guía {carrier?.label ?? order.carrier ?? ""}</small><strong>{order.trackingCode}</strong></span>
        <button type="button" className="tracking-copy" onClick={() => void copy()} aria-label="Copiar número de guía">
          {copied ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}<span>{copied ? "Copiada" : "Copiar"}</span>
        </button>
      </div>
      <span className="sr-only" role="status">{copied ? "Número de guía copiado" : ""}</span>
      {carrier && <a className="order-other tracking-link" href={carrier.trackingPage} target="_blank" rel="noopener noreferrer">
        <ArrowSquareOut size={18} aria-hidden="true" /> Ver en {carrier.label}
      </a>}
      {carrier && <p className="cart-note">En la página de {carrier.label} pega tu número de guía.</p>}
      {events.length > 0 && <>
        <ol className="tracking-events" aria-label="Movimientos de la transportadora">
          {(all ? events : events.slice(0, FIRST)).map((e, i) => <li key={`${e.at}-${i}`}>
            <time dateTime={e.at}>{dates.format(new Date(e.at))}{e.location ? ` · ${e.location}` : ""}</time>
            <span>{e.description}</span>
          </li>)}
        </ol>
        {events.length > FIRST && <button type="button" className="coupon-toggle" aria-expanded={all} onClick={() => setAll(v => !v)}>{all ? "Ver menos" : `Ver los ${events.length} movimientos`}</button>}
      </>}
      {tracking?.checkedAt && <p className="cart-note">Actualizado el {dates.format(new Date(tracking.checkedAt))}.</p>}
    </div>
  )
}

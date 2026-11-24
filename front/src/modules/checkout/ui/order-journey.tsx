"use client"

import { CheckCircle, Circle, XCircle } from "@phosphor-icons/react"
import type { JourneyStep } from "../domain/checkout"

const when = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "America/Bogota" })
const toneIcon = { good: CheckCircle, info: Circle, bad: XCircle } as const

/** Every step the order went through, oldest first, the newest one marked as where it is now. */
export function OrderJourney({ steps }: { steps: JourneyStep[] }) {
  return (
    <section className="checkout-card squircle" aria-labelledby="order-journey">
      <h2 id="order-journey">Así va tu pedido</h2>
      <ol className="order-journey">
        {steps.map((step, index) => {
          const Icon = toneIcon[step.tone] ?? Circle
          const current = index === steps.length - 1
          return (
            <li key={`${step.key}-${step.at}`} data-tone={step.tone} aria-current={current ? "step" : undefined}>
              <span className="order-journey-dot"><Icon size={18} weight="fill" aria-hidden="true" /></span>
              <span className="order-journey-text">
                <strong>{step.title}</strong>
                {step.detail && <span>{step.detail}</span>}
                <time dateTime={step.at}>{when.format(new Date(step.at))}</time>
              </span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

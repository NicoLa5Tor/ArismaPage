"use client"

import Link from "next/link"
import { useLiveChanges } from "../../shared/ui/live-changes"
import { useCallback, useEffect, useRef, useState } from "react"
import { ArrowLeft, Bell, CheckCircle, CircleNotch, Clock, FileArrowDown, Flask, ImageSquare, WarningCircle, WhatsappLogo, XCircle } from "@phosphor-icons/react"
import { usePort } from "../../shared/ui/ports"
import type { CheckoutPort, OrderAccess } from "../application/checkout-port"
import { type OrderView as Order, type PaymentOutcome, money, quoteImageSrc, stageLabels } from "../domain/checkout"
import { goToPayment } from "./go-to-payment"
import { OrderTracking } from "./order-tracking"
import { OrderJourney } from "./order-journey"
import { CancelOrder, RefundStatus } from "./cancel-order"
import { useStoreProfile } from "../../shared/ui/store-profile"
import { optimized } from "../../shared/ui/optimized-image"

const toneIcon = { good: CheckCircle, warn: Clock, bad: XCircle, info: CheckCircle } as const
const dates = new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeStyle: "short", timeZone: "America/Bogota" })

/**
 * The shopper's page for one order: its state, what it carries and how to pay it. It is reached with the order key
 * (from the confirmation) or from the account. When the shopper comes back from the gateway, what the gateway left in
 * the address is sent to the store to be verified; the page never decides on its own.
 */
export function OrderView({ access, returned, whatsapp, cleanUrl }: { access: OrderAccess | null; returned: Record<string, string>; whatsapp?: string; cleanUrl: string }) {
  const port = usePort<CheckoutPort>("checkout")
  const profile = useStoreProfile()
  const [order, setOrder] = useState<Order | null>(null)
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error">("loading")
  const [outcome, setOutcome] = useState<PaymentOutcome | null>(null)
  const [paying, setPaying] = useState(false), [payError, setPayError] = useState("")
  const confirmed = useRef(false)
  const lastStep = useRef<string | null>(null)
  const [news, setNews] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!access) return
    try {
      const found = await port.order(access)
      // a step that arrived while the page was open is announced (the first load only sets the baseline)
      const newest = found.journey?.at(-1)
      const id = newest ? `${newest.key}@${newest.at}` : null
      if (lastStep.current !== null && id !== null && id !== lastStep.current) setNews(newest!.title)
      lastStep.current = id ?? ""
      setOrder(found); setState("ready")
      // looking at the order is seeing its news
      void port.markSeen(access).catch(() => {})
    }
    catch (error) { const status = (error as { status?: number }).status; setState(status === 404 ? "missing" : "error") }
  }, [port, access])

  useEffect(() => {
    if (!access || confirmed.current) return
    confirmed.current = true
    const fromGateway = Object.keys(returned).length > 0
    // the gateway's parameters leave the address bar once they were handed to the store
    if (fromGateway) window.history.replaceState(null, "", cleanUrl)
    void (async () => {
      // from the gateway: verify what it sent. Otherwise still ask the store to check, in case the shopper paid and
      // closed the gateway's page before it sent them back
      try { const result = await port.confirmReturn(access, fromGateway ? returned : {}); if (fromGateway || result.status === "approved") setOutcome(result) } catch { /* the order below still tells the truth */ }
      await load()
    })()
  }, [port, access, returned, load, cleanUrl])

  // the order's page follows it live: paid, sent, every movement of the carrier, without reloading
  const open = order !== null && order.stage !== "delivered" && order.stage !== "cancelled"
  useLiveChanges(access && open ? port.liveUrl(access) : null, () => void load())

  // a payment still being processed is settled by the gateway's notice: look again a few times
  useEffect(() => {
    if (!order || order.status !== "pending" || !outcome || (outcome.status !== "pending" && outcome.status !== "started")) return
    const timer = window.setTimeout(() => void load(), 6000)
    return () => window.clearTimeout(timer)
  }, [order, outcome, load])

  async function pay() {
    if (!access) return
    setPaying(true); setPayError("")
    try { if (!goToPayment(await port.startPayment(access))) { await load(); setPaying(false) } }
    catch (error) { setPayError(error instanceof Error ? error.message : "No se pudo abrir el pago."); setPaying(false) }
  }

  if (!access) return null
  // a key link of an order that belongs to an account: it is seen signed in, in "Mis pedidos"
  if (state === "missing" && access.kind === "key") return <ToAccount number={access.number} returned={returned} />
  if (state === "loading") return <div className="order-body" aria-busy="true"><p className="store-wait"><CircleNotch className="spin" size={20} aria-hidden="true" /> Buscando tu pedido…</p></div>
  if (state !== "ready" || !order) return (
    <div className="order-body"><div className="cart-empty cart-empty-page">
      <h1>{state === "missing" ? "No encontramos este pedido" : "No pudimos cargar tu pedido"}</h1>
      <p>{state === "missing" ? (access.kind === "key" ? "Abre el enlace completo que te dimos al comprar. Si lo perdiste, entra a tu cuenta o escríbenos por WhatsApp con tu número de pedido." : "Este pedido no está en tu cuenta. Si lo hiciste con otro correo, ábrelo desde el enlace de su confirmación.") : "Revisa tu conexión e inténtalo de nuevo."}</p>
      {state === "error" ? <button type="button" className="button-primary" onClick={() => { setState("loading"); void load() }}>Intentar de nuevo</button> : <a className="button-primary" href={whatsapp} target="_blank" rel="noopener noreferrer"><WhatsappLogo size={18} weight="fill" aria-hidden="true" /> Escribir por WhatsApp</a>}
    </div></div>
  )

  const stage = stageLabels[order.stage] ?? stageLabels.issue
  const Icon = toneIcon[stage.tone]
  const pending = order.status === "pending"
  const declined = pending && outcome && (outcome.status === "declined" || outcome.status === "voided" || outcome.status === "error")
  const products = order.lines.reduce((sum, line) => sum + Number(line.total), 0)
  return (
    <div className="order-body">
      {access.kind === "account" && <Link href="/cuenta" className="checkout-back"><ArrowLeft size={18} aria-hidden="true" /> Mis pedidos</Link>}
      <header className="order-head">
        <p className="eyebrow">Pedido #{order.number}</p>
        <h1>{order.firstName ? `${order.firstName}, ` : ""}{pending ? "tu pedido está guardado" : order.stage === "cancelled" ? "este pedido se canceló" : "gracias por tu compra"}</h1>
        <p className="order-stage squircle" data-tone={stage.tone}><Icon size={24} weight="fill" aria-hidden="true" /> <span><strong>{stage.label}</strong> {stage.text}</span></p>
        {order.invoiceToken && <a className="button-secondary squircle order-invoice" href={`/factura/${encodeURIComponent(order.invoiceToken)}`} download><FileArrowDown size={20} aria-hidden="true" /> Descargar la factura</a>}
        {order.test && <p className="test-mode squircle" role="note"><Flask size={18} weight="fill" aria-hidden="true" /> Pedido de prueba: no se hizo ni se hará ningún cobro real.</p>}
      </header>

      {declined && <p className="store-alert" role="alert"><WarningCircle size={20} weight="fill" aria-hidden="true" /> {outcome.message}. No se hizo ningún cobro; puedes intentarlo de nuevo.</p>}
      {pending && outcome && (outcome.status === "pending" || outcome.status === "started") && <p className="order-notice squircle" role="status"><CircleNotch className="spin" size={20} aria-hidden="true" /> Estamos confirmando tu pago con la pasarela. Esta página se actualiza sola.</p>}
      {news && <p className="order-notice order-news squircle" role="status"><Bell size={20} weight="fill" aria-hidden="true" /> <span><strong>Tu pedido cambió:</strong> {news}</span><button type="button" className="order-news-close" onClick={() => setNews(null)} aria-label="Cerrar aviso"><XCircle size={18} aria-hidden="true" /></button></p>}
      {outcome?.status === "approved" && order.stage !== "cancelled" && <p className="order-notice squircle" role="status"><CheckCircle size={20} weight="fill" aria-hidden="true" /> {outcome.message}. Te enviamos la confirmación a tu correo.</p>}

      <div className="order-grid">
        <div className="order-main">
        {order.journey && order.journey.length > 0 && <OrderJourney steps={order.journey} />}
        <section className="checkout-card squircle" aria-labelledby="order-items">
          <h2 id="order-items">Lo que pediste</h2>
          <ul className="summary-lines">
            {order.lines.map((line, index) => { const src = quoteImageSrc({ productId: line.productId ?? "", imageId: line.imageId, imageUrl: line.imageUrl, imageUploaded: line.imageUploaded }); return (
              <li key={index}>
                <span className="summary-photo squircle">{src ? <img {...optimized(src, { sizes: "56px", width: 56 })} alt="" width={56} height={56} loading="lazy" decoding="async" /> : <ImageSquare size={20} aria-hidden="true" />}<b>{line.quantity}</b></span>
                <span className="summary-title">{line.slug ? <Link href={`/producto/${encodeURIComponent(line.slug)}`}>{line.title}</Link> : line.title}</span>
                <span className="summary-price">{money(Number(line.total))}</span>
              </li>
            ) })}
          </ul>
          <dl className="order-totals">
            <div><dt>Productos</dt><dd>{money(products)}</dd></div>
            {Number(order.discount) > 0 && <div className="order-summary-discount"><dt>Cupón {order.coupon}</dt><dd>−{money(Number(order.discount))}</dd></div>}
            <div><dt>{order.shippingLabel ?? "Envío"}</dt><dd>{Number(order.shippingTotal) === 0 ? "Sin costo" : money(Number(order.shippingTotal))}</dd></div>
            <div className="order-summary-total"><dt>Total</dt><dd>{money(Number(order.total))}</dd></div>
          </dl>
        </section>
        </div>

        <aside className="order-side">
          <section className="checkout-card squircle" aria-labelledby="order-pay">
            <h2 id="order-pay">Pago</h2>
            <p className="order-fact">{order.paymentMethodTitle ?? "Por definir"}{order.paidAt ? ` · pagado el ${dates.format(new Date(order.paidAt))}` : ""}</p>
            {pending && order.instructions && <p className="order-instructions">{order.instructions}</p>}
            {pending && order.canPay && <button type="button" className="button-primary" disabled={paying} onClick={() => void pay()}>{paying ? <><CircleNotch className="spin" size={18} aria-hidden="true" /> Abriendo…</> : `${declined ? "Intentar de nuevo" : "Pagar"} con ${order.payWith}`}</button>}
            {pending && !order.canPay && !order.instructions && <p className="cart-note">El pago por la página no está disponible ahora. Escríbenos por WhatsApp y lo resolvemos.</p>}
            {payError && <p className="store-alert" role="alert">{payError}</p>}
            {pending && order.expiresAt && <p className="cart-note">Guardamos tu pedido hasta el {dates.format(new Date(order.expiresAt))}.</p>}
          </section>
          <section className="checkout-card squircle" aria-labelledby="order-delivery">
            <h2 id="order-delivery">Entrega</h2>
            <p className="order-fact">{order.deliveryMethod === "pickup" ? (profile.pickupLine ? `Recoges en la tienda: ${profile.pickupLine}.` : "Recoges en la tienda.") : [order.address, order.city].filter(Boolean).join(", ") || "Te confirmamos la entrega por WhatsApp."}</p>
            <OrderTracking order={order} />
            <p className="cart-note">Hecho el {dates.format(new Date(order.placedAt))}.{access.kind === "key" ? " Guarda este enlace para seguir tu pedido." : ""}</p>
          </section>
          <RefundStatus order={order} access={access} onChanged={(next) => setOrder(next)} />
          <CancelOrder order={order} access={access} onChanged={(next) => setOrder(next)} />
          <a className="buy-whatsapp is-secondary squircle" href={whatsapp} target="_blank" rel="noopener noreferrer"><WhatsappLogo size={20} weight="fill" aria-hidden="true" /> Ayuda con mi pedido</a>
        </aside>
      </div>
    </div>
  )
}

/** Sends a key link of an account's order to the same order in the account, which asks to sign in with it. */
function ToAccount({ number, returned }: { number: string; returned: Record<string, string> }) {
  useEffect(() => {
    const query = new URLSearchParams(returned).toString()
    window.location.replace(`/cuenta/pedidos/${encodeURIComponent(number)}${query ? `?${query}` : ""}`)
  }, [number, returned])
  return <div className="order-body" aria-busy="true"><p className="store-wait"><CircleNotch className="spin" size={20} aria-hidden="true" /> Abriendo tu pedido en tu cuenta…</p></div>
}

"use client"

import Link from "next/link"
import { useMemo } from "react"
import { CircleNotch } from "@phosphor-icons/react"
import { loginUrl } from "../../account/domain/account"
import { useAccount } from "../../account/ui/account-context"
import type { OrderAccess } from "../application/checkout-port"
import { OrderView } from "./order-view"

/** An order opened from "Mis pedidos": reached with the session instead of the key. */
export function OwnedOrder({ number, returned, whatsapp }: { number: string; returned: Record<string, string>; whatsapp?: string }) {
  const { session, ready } = useAccount()
  const csrf = session?.csrf
  const access = useMemo<OrderAccess | null>(() => (csrf ? { kind: "account", number, csrf } : null), [csrf, number])
  if (!ready) return <div className="order-body" aria-busy="true"><p className="store-wait"><CircleNotch className="spin" size={20} aria-hidden="true" /> Revisando tu sesión…</p></div>
  if (!access) return (
    <div className="order-body"><div className="cart-empty cart-empty-page">
      <h1>Entra para ver este pedido</h1>
      <p>Los pedidos de tu cuenta se ven con la sesión iniciada.</p>
      <Link href={loginUrl(`/cuenta/pedidos/${encodeURIComponent(number)}`)} className="button-primary">Entrar</Link>
    </div></div>
  )
  return <OrderView access={access} returned={returned} whatsapp={whatsapp} cleanUrl={`/cuenta/pedidos/${encodeURIComponent(number)}`} />
}

/** An order opened with its key, as the confirmation link gives it. */
export function KeyedOrder({ number, orderKey, returned, whatsapp }: { number: string; orderKey: string; returned: Record<string, string>; whatsapp?: string }) {
  const access = useMemo<OrderAccess | null>(() => (orderKey ? { kind: "key", number, key: orderKey } : null), [number, orderKey])
  if (!access) return <div className="order-body"><div className="cart-empty cart-empty-page"><h1>Enlace incompleto</h1><p>Abre el enlace completo del correo de tu pedido o entra a tu cuenta.</p><Link href="/cuenta" className="button-primary">Ir a mi cuenta</Link></div></div>
  return <OrderView access={access} returned={returned} whatsapp={whatsapp} cleanUrl={`/pedido/${encodeURIComponent(number)}?clave=${encodeURIComponent(orderKey)}`} />
}

"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
import { Bell, UserCircle, X } from "@phosphor-icons/react"
import { firstName, loginUrl } from "../domain/account"
import { useAccount } from "./account-context"
import { usePort } from "../../shared/ui/ports"
import { useLiveChanges } from "../../shared/ui/live-changes"
import type { CheckoutPort } from "../../checkout/application/checkout-port"
import type { OrderNews } from "../../checkout/domain/checkout"

/**
 * Header link to the account: the shopper's first name when signed in, "Entrar" otherwise. Signed in, it also counts
 * the orders with a step the shopper has not seen, and when one changes while they browse it shows a notice.
 */
export function AccountButton({ className = "" }: { className?: string }) {
  const { session, ready } = useAccount()
  const path = usePathname()
  const signedIn = ready && session
  const news = useOrderNews(Boolean(signedIn))
  const count = news.items.length
  return (
    <>
      <Link href={signedIn ? "/cuenta" : loginUrl(path || "/")} className={`account-button squircle ${className}`}
        aria-label={signedIn ? `Tu cuenta, ${session.shopper.name}${count ? `. ${count === 1 ? "Un pedido tiene" : `${count} pedidos tienen`} novedades` : ""}` : "Entrar o crear cuenta"}>
        <UserCircle size={20} weight={signedIn ? "fill" : "regular"} aria-hidden="true" />
        <span className="account-button-label">{signedIn ? firstName(session.shopper.name) : "Entrar"}</span>
        {count > 0 && <span className="account-button-badge" aria-hidden="true">{count > 9 ? "9+" : count}</span>}
      </Link>
      {news.toast && (
        <div className="order-toast squircle" role="status">
          <Bell size={20} weight="fill" aria-hidden="true" />
          <Link href={`/cuenta/pedidos/${encodeURIComponent(news.toast.number)}`} onClick={news.dismiss}>
            <strong>Pedido #{news.toast.number}</strong><span>{news.toast.step}</span>
          </Link>
          <button type="button" onClick={news.dismiss} aria-label="Cerrar aviso"><X size={16} aria-hidden="true" /></button>
        </div>
      )}
    </>
  )
}

/** The account's order news, kept fresh by the store's live notices; a newly arrived one becomes a toast. */
function useOrderNews(signedIn: boolean) {
  const port = usePort<CheckoutPort>("checkout")
  const path = usePathname()
  const [items, setItems] = useState<OrderNews[]>([])
  const [toast, setToast] = useState<OrderNews | null>(null)
  const known = useRef<Set<string> | null>(null)
  const refresh = useCallback(async (announce: boolean) => {
    try {
      const found = await port.news()
      const ids = new Set(found.map((n) => `${n.number}@${n.at}`))
      // announced only when it arrives while browsing, and not on the page of that same order
      const fresh = announce && known.current ? found.find((n) => !known.current!.has(`${n.number}@${n.at}`)) : undefined
      known.current = ids
      setItems(found)
      if (fresh && !window.location.pathname.endsWith(`/pedidos/${encodeURIComponent(fresh.number)}`)) setToast(fresh)
    } catch { /* the notices are a convenience: the account page still shows every order */ }
  }, [port])
  // eslint-disable-next-line react-hooks/set-state-in-effect -- the list follows the session and the page the shopper is on
  useEffect(() => { if (signedIn) void refresh(false); else { setItems([]); known.current = null } }, [signedIn, path, refresh])
  useLiveChanges(signedIn ? port.newsUrl() : null, () => void refresh(true))
  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 12_000)
    return () => window.clearTimeout(timer)
  }, [toast])
  return { items, toast, dismiss: () => setToast(null) }
}

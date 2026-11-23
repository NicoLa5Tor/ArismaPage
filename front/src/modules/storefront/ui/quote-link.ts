"use client"

import { usePathname } from "next/navigation"
import { useAccount } from "../../account/ui/account-context"

/**
 * Where a «Cotizar» button goes. Quoting needs an account (only signing in, nothing else to fill in): signed in it
 * opens WhatsApp with the message; signed out it goes to sign in and comes back to this page.
 */
export function useQuoteLink(whatsappHref: string | undefined): { href: string | undefined; external: boolean; needsSignIn: boolean } {
  const { session } = useAccount()
  const pathname = usePathname()
  if (session) return { href: whatsappHref, external: true, needsSignIn: false }
  return { href: `/cuenta?volver=${encodeURIComponent(pathname || "/")}&motivo=cotizar`, external: false, needsSignIn: true }
}

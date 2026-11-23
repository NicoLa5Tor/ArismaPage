"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { UserCircle } from "@phosphor-icons/react"
import { firstName, loginUrl } from "../domain/account"
import { useAccount } from "./account-context"

/** Header link to the account: the shopper's first name when signed in, "Entrar" otherwise. */
export function AccountButton({ className = "" }: { className?: string }) {
  const { session, ready } = useAccount()
  const path = usePathname()
  const signedIn = ready && session
  return (
    <Link href={signedIn ? "/cuenta" : loginUrl(path || "/")} className={`account-button squircle ${className}`} aria-label={signedIn ? `Tu cuenta, ${session.shopper.name}` : "Entrar o crear cuenta"}>
      <UserCircle size={20} weight={signedIn ? "fill" : "regular"} aria-hidden="true" />
      <span className="account-button-label">{signedIn ? firstName(session.shopper.name) : "Entrar"}</span>
    </Link>
  )
}

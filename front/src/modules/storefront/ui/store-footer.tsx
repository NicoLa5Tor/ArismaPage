"use client"

import Link from "next/link"
import { LEGAL_KINDS, LEGAL_LABELS } from "../../shared/domain/legal"
import { legalHref } from "../../shared/domain/store-profile"
import { useStoreProfile } from "../../shared/ui/store-profile"

/**
 * The foot of every store page: who sells (legal name, NIT, address, phone, email and WhatsApp, as Ley 1480 art. 50
 * asks of online sellers), the legal pages the store published and where to complain (the SIC). Everything comes from
 * the store profile, so it changes the moment the panel saves it.
 */
export function StoreFooter() {
  const profile = useStoreProfile()
  const who = profile.legalName || profile.name
  const links = LEGAL_KINDS.map((kind) => ({ kind, href: legalHref(profile, kind) })).filter((l): l is { kind: typeof l.kind; href: string } => !!l.href)
  const contact = [
    profile.pickupLine && { label: profile.pickupLine },
    profile.phone && { label: `Tel. ${profile.phone}`, href: `tel:${profile.phone.replace(/[^\d+]/g, "")}` },
    profile.whatsapp && { label: `WhatsApp ${profile.whatsappLabel}`, href: `https://wa.me/${profile.whatsapp}`, external: true },
    profile.email && { label: profile.email, href: `mailto:${profile.email}` },
  ].filter(Boolean) as { label: string; href?: string; external?: boolean }[]
  return (
    <footer className="store-footer" aria-label="Datos de la tienda">
      <div className="store-footer-inner">
        <p className="store-footer-who">© {new Date().getFullYear()} {who}{profile.taxId ? ` · NIT ${profile.taxId}` : ""}</p>
        {contact.length > 0 && <ul className="store-footer-contact">{contact.map((c) => <li key={c.label}>{c.href ? <a href={c.href} {...(c.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>{c.label}</a> : c.label}</li>)}</ul>}
        {profile.hours.length > 0 && <p className="store-footer-hours">{profile.hours.join(" · ")}</p>}
        <nav aria-label="Páginas legales">
          <ul className="store-footer-links">
            {links.map((l) => <li key={l.kind}>{l.href.startsWith("/") ? <Link href={l.href}>{LEGAL_LABELS[l.kind]}</Link> : <a href={l.href} target="_blank" rel="noopener noreferrer">{LEGAL_LABELS[l.kind]}</a>}</li>)}
            <li><a href="https://www.sic.gov.co" target="_blank" rel="noopener noreferrer">Superintendencia de Industria y Comercio</a></li>
            <li><Link href="/admin">Administración</Link></li>
          </ul>
        </nav>
      </div>
    </footer>
  )
}

"use client"

import Link from "next/link"
import { Clock, EnvelopeSimple, FacebookLogo, InstagramLogo, MapPin, Phone, WhatsappLogo, YoutubeLogo } from "@phosphor-icons/react"
import { store } from "../domain/home"
import { LEGAL_KINDS, LEGAL_LABELS } from "../../shared/domain/legal"
import { legalHref } from "../../shared/domain/store-profile"
import { useStoreProfile, useWhatsapp } from "../../shared/ui/store-profile"
import { optimized } from "../../shared/ui/optimized-image"

/**
 * The one foot of every store page: the brand, the shop, how to reach it and the legal pages it published, and below
 * who sells (legal name and NIT, as Ley 1480 art. 50 asks of online sellers) and where to complain (the SIC). The data
 * comes from the store profile, so it changes the moment the panel saves it.
 */
export function StoreFooter() {
  const whatsappUrl = useWhatsapp()
  const profile = useStoreProfile()
  const legal = LEGAL_KINDS.map((kind) => ({ kind, href: legalHref(profile, kind) })).filter((l): l is { kind: typeof l.kind; href: string } => !!l.href)
  return (
    // the store's colours and type live on .storefront, and the footer sits after the page, outside its <main>
    <div className="storefront">
    <footer className="site-footer">
      <div className="home-inner site-footer-grid">
        <div className="site-footer-brand">
          <img {...optimized("/brand/logo-arisma-2023.jpg", { sizes: "120px", width: 120 })} alt={profile.name} width={120} height={48} loading="lazy" />
          <p>Ayudamos a padres y maestros a formar generaciones de niños increíbles desde {store.since}.</p>
          <ul className="site-footer-social">
            <li><a href={store.instagram} target="_blank" rel="noopener noreferrer" aria-label={`${profile.name} en Instagram`}><InstagramLogo size={24} aria-hidden="true" /></a></li>
            <li><a href={store.facebook} target="_blank" rel="noopener noreferrer" aria-label={`${profile.name} en Facebook`}><FacebookLogo size={24} aria-hidden="true" /></a></li>
            <li><a href={store.youtube} target="_blank" rel="noopener noreferrer" aria-label={`${profile.name} en YouTube`}><YoutubeLogo size={24} aria-hidden="true" /></a></li>
          </ul>
        </div>
        {(profile.pickupLine || profile.hours.length > 0) && <div>
          <h2>Tienda</h2>
          <ul>
            {profile.pickupLine && <li><MapPin size={18} aria-hidden="true" /> <span>{profile.pickupLine}</span></li>}
            {profile.hours.length > 0 && <li><Clock size={18} aria-hidden="true" /> <span>{profile.hours.map((h, i) => <span key={h}>{i > 0 && <br />}{h}</span>)}</span></li>}
          </ul>
        </div>}
        <div>
          <h2>Contacto</h2>
          <ul>
            {profile.phone && <li><Phone size={18} aria-hidden="true" /> <a href={`tel:${profile.phone.replace(/[^\d+]/g, "")}`}>{profile.phone}</a></li>}
            {profile.whatsapp && <li><WhatsappLogo size={18} aria-hidden="true" /> <a href={whatsappUrl("Hola, quiero información sobre sus productos")} target="_blank" rel="noopener noreferrer">{profile.whatsappLabel}</a></li>}
            {profile.email && <li><EnvelopeSimple size={18} aria-hidden="true" /> <a href={`mailto:${profile.email}`}>{profile.email}</a></li>}
          </ul>
        </div>
        <nav aria-label="Enlaces del sitio">
          <h2>Explora</h2>
          <ul>
            <li><Link href="/productos">Productos</Link></li>
            <li><Link href="/buscar">Pregúntale a {profile.name}</Link></li>
            {legal.map((l) => <li key={l.kind}>{l.href.startsWith("/") ? <Link href={l.href}>{LEGAL_LABELS[l.kind]}</Link> : <a href={l.href} target="_blank" rel="noopener noreferrer">{LEGAL_LABELS[l.kind]}</a>}</li>)}
          </ul>
        </nav>
      </div>
      <div className="home-inner site-footer-legal">
        <p>© {new Date().getFullYear()} {profile.legalName || profile.name}{profile.taxId ? ` · NIT ${profile.taxId}` : ""}</p>
        <ul>
          <li><a href="https://www.sic.gov.co" target="_blank" rel="noopener noreferrer">Superintendencia de Industria y Comercio</a></li>
          <li><Link href="/admin">Administración</Link></li>
        </ul>
      </div>
    </footer>
    </div>
  )
}

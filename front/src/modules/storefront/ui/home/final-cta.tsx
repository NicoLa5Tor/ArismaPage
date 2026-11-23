"use client"

import Link from "next/link"
import gsap from "gsap"
import { ArrowRight, Clock, FacebookLogo, InstagramLogo, MapPin, Phone, WhatsappLogo, YoutubeLogo } from "@phosphor-icons/react"
import { type CatalogCategory } from "../../domain/catalog"
import { store } from "../../domain/home"
import { categoryIcon } from "../catalog/category-icons"
import { Marquee } from "./marquee"
import { type Scene, useScene } from "./scene"
import { useStoreProfile, useWhatsapp } from "../../../shared/ui/store-profile"
import { legalHref } from "../../../shared/domain/store-profile"
import type { LegalKind } from "../../../shared/domain/legal"
import { optimized } from "../../../shared/ui/optimized-image"

// The brand name rises letter by letter as the page ends; on desktop the main button leans towards the cursor.
function build(root: HTMLElement, { desktop }: Scene) {
  gsap.fromTo(".wordmark span", { yPercent: 110 }, { yPercent: 0, ease: "none", stagger: 0.08, scrollTrigger: { trigger: ".wordmark", start: "top bottom", end: "bottom bottom", scrub: 0.6 } })
  if (!desktop) return
  const zone = root.querySelector<HTMLElement>(".magnet")
  const button = zone?.querySelector<HTMLElement>("a")
  if (!zone || !button) return
  const x = gsap.quickTo(button, "x", { duration: 0.6, ease: "power3.out" })
  const y = gsap.quickTo(button, "y", { duration: 0.6, ease: "power3.out" })
  const move = (event: PointerEvent) => { const box = zone.getBoundingClientRect(); x((event.clientX - box.left - box.width / 2) * 0.3); y((event.clientY - box.top - box.height / 2) * 0.3) }
  const leave = () => { x(0); y(0) }
  zone.addEventListener("pointermove", move)
  zone.addEventListener("pointerleave", leave)
  return () => { zone.removeEventListener("pointermove", move); zone.removeEventListener("pointerleave", leave) }
}

export function FinalCta({ categories }: { categories: CatalogCategory[] }) {
  const whatsappUrl = useWhatsapp()
  const ref = useScene<HTMLElement>(build)
  return (
    <section ref={ref} id="contacto" className="closing" aria-labelledby="contacto-titulo">
      {categories.length > 0 && (
        <Marquee className="closing-marquee">
          {categories.map((category) => {
            const Icon = categoryIcon(category.slug)
            return <Link key={category.id} href={`/productos?categoria=${encodeURIComponent(category.slug)}`} className="closing-tag"><Icon size={24} weight="fill" aria-hidden="true" /> {category.name}</Link>
          })}
        </Marquee>
      )}
      <div className="home-inner closing-inner">
        <h2 id="contacto-titulo">¿Armamos juntos la lista para tu casa o tu salón?</h2>
        <p>Cuéntanos la edad de los niños y lo que quieres trabajar. Te ayudamos a elegir.</p>
        <div className="closing-actions">
          <div className="magnet"><Link href="/productos" className="button-light">Ver juguetes <ArrowRight size={20} weight="bold" aria-hidden="true" /></Link></div>
          <a className="button-ink" href={whatsappUrl("Hola, necesito ayuda para elegir un producto")} target="_blank" rel="noopener noreferrer"><WhatsappLogo size={20} weight="fill" aria-hidden="true" /> Hablar con un asesor</a>
        </div>
      </div>
      <p className="wordmark" aria-hidden="true">{"arisma".split("").map((letter, index) => <span key={index}>{letter}</span>)}</p>
    </section>
  )
}

export function SiteFooter() {
  const whatsappUrl = useWhatsapp()
  return (
    <footer className="site-footer">
      <div className="home-inner site-footer-grid">
        <div className="site-footer-brand">
          <img {...optimized("/brand/logo-arisma-2023.jpg", { sizes: "120px", width: 120 })} alt="Arisma" width={120} height={48} loading="lazy" />
          <p>Ayudamos a padres y maestros a formar generaciones de niños increíbles desde {store.since}.</p>
          <ul className="site-footer-social">
            <li><a href={store.instagram} target="_blank" rel="noopener noreferrer" aria-label="Arisma en Instagram"><InstagramLogo size={24} aria-hidden="true" /></a></li>
            <li><a href={store.facebook} target="_blank" rel="noopener noreferrer" aria-label="Arisma en Facebook"><FacebookLogo size={24} aria-hidden="true" /></a></li>
            <li><a href={store.youtube} target="_blank" rel="noopener noreferrer" aria-label="Arisma en YouTube"><YoutubeLogo size={24} aria-hidden="true" /></a></li>
          </ul>
        </div>
        <div>
          <h2>Tienda</h2>
          <ul>
            <li><MapPin size={18} aria-hidden="true" /> <span>{store.address}<br />{store.city}</span></li>
            <li><Clock size={18} aria-hidden="true" /> <span>{store.hours[0]}<br />{store.hours[1]}</span></li>
          </ul>
        </div>
        <div>
          <h2>Contacto</h2>
          <ul>
            <li><Phone size={18} aria-hidden="true" /> <a href={store.phone.href}>{store.phone.label}</a></li>
            <li><WhatsappLogo size={18} aria-hidden="true" /> <a href={whatsappUrl("Hola, quiero información sobre sus productos")} target="_blank" rel="noopener noreferrer">{store.mobile.label}</a></li>
          </ul>
        </div>
        <nav aria-label="Enlaces del sitio">
          <h2>Explora</h2>
          <ul>
            <li><Link href="/productos">Productos</Link></li>
            <li><Link href="/buscar">Pregúntale a Arisma</Link></li>
            <LegalLink kind="terms">Términos y condiciones</LegalLink>
            <LegalLink kind="privacy">Tratamiento de datos</LegalLink>
          </ul>
        </nav>
      </div>
      <div className="home-inner site-footer-legal">
        <p>© {new Date().getFullYear()} {store.legalName} NIT {store.taxId}</p>
        <Link href="/admin">Administración</Link>
      </div>
    </footer>
  )
}

/** The store's own legal page when it wrote one; the address in its profile otherwise, in a new tab. */
function LegalLink({ kind, children }: { kind: LegalKind; children: string }) {
  const href = legalHref(useStoreProfile(), kind)
  if (!href) return null
  return <li>{href.startsWith("/") ? <Link href={href}>{children}</Link> : <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>}</li>
}

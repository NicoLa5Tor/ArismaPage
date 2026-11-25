"use client"

import Link from "next/link"
import gsap from "gsap"
import { ArrowRight, WhatsappLogo } from "@phosphor-icons/react"
import { type CatalogCategory } from "../../domain/catalog"
import { categoryIcon } from "../catalog/category-icons"
import { Marquee } from "./marquee"
import { type Scene, useScene } from "./scene"
import { useWhatsapp } from "../../../shared/ui/store-profile"

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

"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { AccountButton } from "../../../account/ui/account-button"
import { CartButton } from "../../../cart/ui/cart-button"
import { MobileMenu } from "../mobile-menu"
import { SearchLauncher } from "../search/search-launcher"
import { optimized } from "../../../shared/ui/optimized-image"

type State = "top" | "shown" | "hidden"

/** Sits on top of the story; once the story is over it floats: hidden while reading down, back as soon as the shopper scrolls up. */
export function SiteHeader() {
  const [state, setState] = useState<State>("top")
  const [searching, setSearching] = useState(false)
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger)
    const trigger = ScrollTrigger.create({
      trigger: ".scroll-world", start: "bottom top", end: "max",
      onUpdate: (self) => setState(self.direction === 1 ? "hidden" : "shown"),
      onLeaveBack: () => setState("top"),
    })
    return () => trigger.kill()
  }, [])
  return (
    <header className="storefront-header" data-state={state} data-searching={searching || undefined}>
      <Link href="/" className="brand" aria-label="Arisma, inicio"><img {...optimized("/brand/logo-arisma-2023.jpg", { sizes: "120px", width: 120 })} alt="Arisma" width={120} height={48} /></Link>
      <nav aria-label="Principal">
        <Link href="/productos" className="header-link">Productos</Link>
        <Link href="/buscar" className="header-link">Pregúntale a Arisma</Link>
        <a href="#contacto" className="header-link">Contacto</a>
        <SearchLauncher className="header-search" onOpenChange={setSearching} />
        <AccountButton />
        <CartButton />
        <MobileMenu contactHref="#contacto" />
      </nav>
    </header>
  )
}

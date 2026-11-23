import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, MagnifyingGlass } from "@phosphor-icons/react/ssr"
import { StoreHeader } from "../../modules/storefront/ui/store-header"

export const metadata: Metadata = { title: "No encontramos esta página", robots: { index: false, follow: true } }

/** Branded 404 for the store: says what happened and offers the two ways to keep looking. */
export default function StoreNotFound() {
  return (
    <main id="contenido" className="storefront catalog store-missing">
      <StoreHeader />
      <section className="store-missing-body">
        <p className="eyebrow">Error 404</p>
        <h1>Esta página ya no está en la tienda</h1>
        <p>Puede que el producto haya cambiado de nombre o que ya no lo vendamos. El catálogo completo sigue a un paso.</p>
        <div className="store-missing-actions">
          <Link href="/productos" className="button-primary">Ver todos los productos <ArrowRight size={18} weight="bold" aria-hidden="true" /></Link>
          <Link href="/buscar" className="link-arrow"><MagnifyingGlass size={18} weight="bold" aria-hidden="true" /> Pregúntale al asistente</Link>
        </div>
      </section>
    </main>
  )
}

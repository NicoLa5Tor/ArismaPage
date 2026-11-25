import Link from "next/link"
import { ArrowRight, MagnifyingGlass } from "@phosphor-icons/react/ssr"
import type { ErrorPage } from "../../../shared/domain/error-page"
import { StoreHeader } from "../store-header"
import { CustomError } from "./custom-error"

/** The store's 404: its own page when it wrote one in the panel, else the built-in one with the two ways to keep looking. */
export function StoreMissing({ custom }: { custom: ErrorPage | null }) {
  return (
    <main id="contenido" className="storefront catalog store-missing">
      <StoreHeader />
      {custom ? <CustomError page={custom} /> : (
        <section className="store-missing-body">
          <p className="eyebrow">Error 404</p>
          <h1>Esta página ya no está en la tienda</h1>
          <p>Puede que el producto haya cambiado de nombre o que ya no lo vendamos. El catálogo completo sigue a un paso.</p>
          <div className="store-missing-actions">
            <Link href="/productos" className="button-primary">Ver todos los productos <ArrowRight size={18} weight="bold" aria-hidden="true" /></Link>
            <Link href="/buscar" className="link-arrow"><MagnifyingGlass size={18} weight="bold" aria-hidden="true" /> Pregúntale al asistente</Link>
          </div>
        </section>
      )}
    </main>
  )
}

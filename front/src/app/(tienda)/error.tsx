"use client"

import { useEffect, useState } from "react"
import { ArrowClockwise, WhatsappLogo } from "@phosphor-icons/react"
import { httpErrorPages } from "../../modules/shared/adapters/http-legal"
import type { ErrorPage } from "../../modules/shared/domain/error-page"
import { whatsappLink } from "../../modules/shared/domain/store-profile"
import { useStoreProfile } from "../../modules/shared/ui/store-profile"
import { StoreHeader } from "../../modules/storefront/ui/store-header"
import { CustomError } from "../../modules/storefront/ui/errors/custom-error"

/** A store page that failed to load: the store's own error page when it wrote one, else a plain way to try again. */
export default function StoreError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const profile = useStoreProfile()
  const [custom, setCustom] = useState<ErrorPage | null | undefined>(undefined)
  useEffect(() => { let on = true; httpErrorPages.load("error").then((p) => { if (on) setCustom(p) }); return () => { on = false } }, [])
  const whatsapp = whatsappLink(profile, "Hola, una página de la tienda no me cargó")
  return (
    <main id="contenido" className="storefront catalog store-missing">
      <StoreHeader />
      {custom ? <CustomError page={custom} onRetry={reset} /> : custom === null && (
        <section className="store-missing-body">
          <p className="eyebrow">Algo salió mal</p>
          <h1>No pudimos cargar esta página</h1>
          <p>Fue un problema nuestro, no tuyo. Vuelve a intentarlo en un momento.</p>
          <div className="store-missing-actions">
            <button type="button" className="button-primary" onClick={reset}><ArrowClockwise size={18} weight="bold" aria-hidden="true" /> Reintentar</button>
            {whatsapp && <a href={whatsapp} className="link-arrow" target="_blank" rel="noopener noreferrer"><WhatsappLogo size={18} weight="bold" aria-hidden="true" /> Escríbenos por WhatsApp</a>}
          </div>
        </section>
      )}
    </main>
  )
}

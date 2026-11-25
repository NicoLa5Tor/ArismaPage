"use client"

import Link from "next/link"
import "./styles.css"

/** When even the page frame fails: a plain page in the store's style that lets the shopper try again. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="es-CO">
      <body>
        <main id="contenido" className="storefront store-missing">
          <section className="store-missing-body">
            <p className="eyebrow">Algo salió mal</p>
            <h1>La tienda no cargó</h1>
            <p>Fue un problema nuestro. Vuelve a intentarlo en un momento.</p>
            <div className="store-missing-actions">
              <button type="button" className="button-primary" onClick={reset}>Reintentar</button>
              <Link href="/" className="link-arrow">Ir al inicio</Link>
            </div>
          </section>
        </main>
      </body>
    </html>
  )
}

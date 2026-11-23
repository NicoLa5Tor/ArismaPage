import type { Metadata } from "next"
import { AccountPanel } from "../../../modules/account/ui/account-panel"
import { StoreHeader } from "../../../modules/storefront/ui/store-header"

export const metadata: Metadata = { title: "Tu cuenta", description: "Entra o crea tu cuenta para opinar sobre los productos, hacer preguntas y usar el asistente.", robots: { index: false, follow: true } }

const REASONS: Record<string, string> = {
  opinar: "Entra para calificar el producto o dejar tu pregunta. Así sabemos que detrás hay una persona.",
  asistente: "Entra para hablar con el asistente. Es gratis y solo toma un momento.",
  cotizar: "Inicia sesión para cotizar. Con Google o Facebook es un clic, y volvemos al producto para abrir WhatsApp.",
  comprar: "Inicia sesión para comprar. Guardamos tus direcciones y tus datos para la próxima, y tu carrito te espera.",
}

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ volver?: string | string[]; motivo?: string | string[] }> }) {
  const params = await searchParams
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? ""
  return (
    <main id="contenido" className="storefront catalog account-page">
      <StoreHeader />
      <div className="account-stage"><AccountPanel next={first(params.volver) || "/"} reason={REASONS[first(params.motivo)]} /></div>
    </main>
  )
}

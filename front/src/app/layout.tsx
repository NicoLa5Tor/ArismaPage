import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import "./styles.css"

export const metadata: Metadata = { title: "Arisma | Administración", description: "Administración del catálogo de Arisma.", icons: { icon: "/brand/favicon-arisma.png" }, robots: { index: false, follow: false } }

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es-CO" className={GeistSans.variable}><body><a className="skip-link" href="#contenido">Saltar al contenido</a>{children}</body></html>
}

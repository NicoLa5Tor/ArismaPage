import type { Metadata, Viewport } from "next"
import { GeistSans } from "geist/font/sans"
import { Poppins } from "next/font/google"
import "./styles.css"
import { BRAND_ICON } from "../modules/shared/domain/brand-assets"

// The public store speaks in Poppins (rounded, friendly, close to the store logo); the admin keeps Geist.
const poppins = Poppins({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-poppins", display: "swap" })

export const metadata: Metadata = { title: "Administración", description: "Administración de la tienda.", icons: { icon: BRAND_ICON }, robots: { index: false, follow: false } }

// viewport-fit=cover lets env(safe-area-inset-*) work on notched phones; the keyboard resizes the layout so fixed bars stay above it
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", interactiveWidget: "resizes-content" }

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es-CO" className={`${GeistSans.variable} ${poppins.variable}`}><body><a className="skip-link" href="#contenido">Saltar al contenido</a>{children}</body></html>
}

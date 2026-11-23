import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { httpPublicCatalog } from "../../modules/storefront/adapters/http-public-catalog"
import { type CatalogCategory, type CatalogProduct, mainCategories } from "../../modules/storefront/domain/catalog"
import { faqs, store } from "../../modules/storefront/domain/home"
import { StorefrontHome } from "../../modules/storefront/ui/storefront-home"

const description = "Rompecabezas, títeres, juegos de mesa y kits de robótica para familias y colegios. Cotiza por WhatsApp y recibe en toda Colombia."

export const metadata: Metadata = {
  metadataBase: new URL(store.site),
  title: { absolute: "Arisma | Juguetes educativos y material didáctico en Colombia" },
  description,
  robots: { index: true, follow: true },
  alternates: { canonical: "/" },
  openGraph: { title: "Arisma | Juguetes educativos y material didáctico en Colombia", description, locale: "es_CO", type: "website", images: ["/scroll-world/historia-poster.jpg"] },
}

const structuredData = [
  {
    "@context": "https://schema.org", "@type": "ToyStore", name: "Arisma", legalName: store.legalName, foundingDate: String(store.since), url: store.site,
    telephone: "+57 601 2102138", sameAs: [store.instagram, store.facebook, store.youtube],
    address: { "@type": "PostalAddress", streetAddress: store.address, addressLocality: "Bogotá", addressCountry: "CO" },
    openingHoursSpecification: [
      { "@type": "OpeningHoursSpecification", dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], opens: "09:00", closes: "17:30" },
      { "@type": "OpeningHoursSpecification", dayOfWeek: "Saturday", opens: "09:30", closes: "17:30" },
    ],
  },
  { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqs.map((faq) => ({ "@type": "Question", name: faq.question, acceptedAnswer: { "@type": "Answer", text: faq.answer } })) },
]

const MIN_RANKED = 4
const FAVORITES = 8

export default async function Home() {
  // This home is Arisma's own page. A store whose home is not made yet (STORE_HOME=catalogo) opens on its catalog.
  if (process.env.STORE_HOME === "catalogo") redirect("/productos")
  // The catalog chapters are a bonus: if the catalog is unreachable the story and the rest of the page still render.
  const [categories, highlights] = await Promise.all([
    httpPublicCatalog.categories().then(mainCategories).catch((): CatalogCategory[] => []),
    httpPublicCatalog.highlights().catch(() => null),
  ])
  const ranked = (highlights?.bestSellers.length ?? 0) >= MIN_RANKED
  let favorites: CatalogProduct[] = highlights?.bestSellers ?? []
  if (!ranked) {
    favorites = await httpPublicCatalog.products({ q: "", category: "", sort: "destacados", offers: false, priced: false, pages: 1, exact: false }).then((page) => page.items.slice(0, FAVORITES)).catch(() => [])
  }
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
      <StorefrontHome categories={categories} favorites={favorites} ranked={ranked} productCount={highlights?.productCount ?? 0} />
    </>
  )
}

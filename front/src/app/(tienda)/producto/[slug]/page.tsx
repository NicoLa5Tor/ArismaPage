import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { cache } from "react"
import { httpPublicCatalog } from "../../../../modules/storefront/adapters/http-public-catalog"
import { productImageSrc } from "../../../../modules/storefront/domain/catalog"
import { httpStoreProfile } from "../../../../modules/shared/adapters/http-store-profile"
import { breadcrumbJsonLd, metaDescription, productJsonLd } from "../../../../modules/storefront/domain/product"
import { Conversations } from "../../../../modules/reviews/ui/conversations"
import { ProductView } from "../../../../modules/storefront/ui/product/product-view"

type Props = { params: Promise<{ slug: string }> }

// Metadata and the page ask for the same product: one request per render.
const load = cache((slug: string) => httpPublicCatalog.product(slug))

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const [detail, profile] = await Promise.all([load(slug).catch(() => null), httpStoreProfile.load()])
  if (!detail) return { title: "Producto no encontrado", robots: { index: false, follow: true } }
  const title = `${detail.product.title}`
  const description = metaDescription(detail, profile.name)
  const image = productImageSrc(detail.product)
  return {
    metadataBase: profile.site ? new URL(profile.site) : undefined,
    title, description,
    robots: { index: true, follow: true },
    alternates: { canonical: `/producto/${encodeURIComponent(detail.product.slug)}` },
    openGraph: { title, description, locale: "es_CO", type: "website", images: image ? [image] : undefined },
  }
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params
  const [detail, profile] = await Promise.all([load(slug), httpStoreProfile.load()])
  if (!detail) notFound()
  const site = profile.site.replace(/\/+$/, "")
  const structured = [productJsonLd(detail, site, profile.name), breadcrumbJsonLd(detail, site)]
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structured).replace(/</g, "\\u003c") }} />
      <ProductView detail={detail} shipsFrom={profile.localCity}>
        <Conversations productId={detail.product.id} reviews={detail.sections.reviews} questions={detail.sections.questions} reviewCount={detail.rating.count} />
      </ProductView>
    </>
  )
}

import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { cache } from "react"
import { httpPublicCatalog } from "../../../../modules/storefront/adapters/http-public-catalog"
import { productImageSrc } from "../../../../modules/storefront/domain/catalog"
import { httpStoreProfile } from "../../../../modules/shared/adapters/http-store-profile"
import { breadcrumbJsonLd, metaDescription, productJsonLd } from "../../../../modules/storefront/domain/product"
import { Conversations } from "../../../../modules/reviews/ui/conversations"
import { ProductView } from "../../../../modules/storefront/ui/product/product-view"
import { LEGAL_PATHS } from "../../../../modules/shared/domain/legal"
import { siteUrl } from "../../../../modules/shared/domain/store-profile"

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
    metadataBase: new URL(siteUrl(profile)),
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
  const site = siteUrl(profile)
  const structured = [productJsonLd(detail, site, profile.name, profile.legal.returns ? `${site}${LEGAL_PATHS.returns}` : undefined), breadcrumbJsonLd(detail, site)]
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structured).replace(/</g, "\\u003c") }} />
      <ProductView detail={detail} profile={profile}>
        <Conversations productId={detail.product.id} reviews={detail.sections.reviews} questions={detail.sections.questions} reviewCount={detail.rating.count} />
      </ProductView>
    </>
  )
}

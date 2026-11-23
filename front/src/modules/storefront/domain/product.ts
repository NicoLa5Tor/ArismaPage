// The public product page: what the store sends for one product and the pure rules around it.
import { type CatalogProduct, formatCop } from "./catalog"

export type Availability = { status: "IN_STOCK" | "BACKORDER" | "OUT_OF_STOCK"; unitsLeft: number | null; maxQuantity: number }
export type GalleryImage = { id: string; url: string | null; uploaded: boolean; alt: string }
export type Crumb = { name: string; slug: string }
export type ProductSpec = { label: string; value: string }

/** Blocks of the page the administrator can show or hide, per product or for the whole store. */
export type SectionKey = "buy" | "whatsapp" | "stock" | "sku" | "highlights" | "description" | "specs" | "age" | "categories" | "shipping" | "reviews" | "questions" | "related"

export type ProductDetail = {
  product: CatalogProduct
  sku: string | null
  shortDescription: string
  /** Already cleaned by the store: formatting tags only. */
  descriptionHtml: string
  highlights: string[]
  specs: ProductSpec[]
  images: GalleryImage[]
  /** Main category first, down to the product's own. */
  breadcrumbs: Crumb[]
  categories: Crumb[]
  ageMin: number | null
  ageMax: number | null
  availability: Availability
  sections: Record<SectionKey, boolean>
  rating: { average: number; count: number }
  related: CatalogProduct[]
}

/** Uploaded photos go through the public image route; historical ones keep their original address. */
export function galleryImageSrc(productId: string, image: GalleryImage): string | null {
  if (image.url && !image.uploaded) return image.url
  return `/api/arisma-public/products/${encodeURIComponent(productId)}/images/${encodeURIComponent(image.id)}`
}

/** What the shopper pays now, or null when the price is not public. */
export const currentPrice = (product: CatalogProduct): number | null => (product.quoteOnly || product.price === null ? null : product.salePrice ?? product.price)

/** Whether the page offers "Agregar al carrito": a public price, units to take and the buy button not hidden. */
export const canBuy = (detail: ProductDetail): boolean => detail.sections.buy && currentPrice(detail.product) !== null && detail.availability.maxQuantity > 0

export function availabilityLabel(availability: Availability): { text: string; tone: "good" | "warn" | "bad" } {
  if (availability.status === "OUT_OF_STOCK") return { text: "Agotado por ahora", tone: "bad" }
  if (availability.status === "BACKORDER") return { text: "Disponible sobre pedido", tone: "warn" }
  if (availability.unitsLeft === 1) return { text: "Queda la última unidad", tone: "warn" }
  if (availability.unitsLeft !== null) return { text: `Quedan ${availability.unitsLeft} unidades`, tone: "warn" }
  return { text: "Disponible para despacho", tone: "good" }
}

export function ageLabel(min: number | null, max: number | null): string | null {
  if (min === null || max === null) return null
  if (max >= 99) return min === 0 ? "Para todas las edades" : `Desde los ${min} años`
  if (min === max) return `Para ${min} ${min === 1 ? "año" : "años"}`
  return `De ${min} a ${max} años`
}

const stripTags = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim()

/** One or two sentences for search engines and link previews: the summary, else the start of the description. */
export function metaDescription(detail: ProductDetail, storeName: string): string {
  const text = detail.shortDescription || stripTags(detail.descriptionHtml)
  const price = currentPrice(detail.product)
  const lead = text ? (text.length > 150 ? `${text.slice(0, 147).trimEnd()}…` : text) : `${detail.product.title} en ${storeName}.`
  return price !== null ? `${lead} ${formatCop(price)} con envío a toda Colombia.` : `${lead} Cotízalo por WhatsApp y recíbelo en toda Colombia.`
}

/** schema.org Product for the page: price and availability only when the store shows them, rating only when there are reviews. */
export function productJsonLd(detail: ProductDetail, site: string, storeName: string): Record<string, unknown> {
  const { product } = detail
  const url = `${site}/producto/${encodeURIComponent(product.slug)}`
  const images = detail.images.map((image) => galleryImageSrc(product.id, image)).filter((src): src is string => Boolean(src)).map((src) => (src.startsWith("/") ? `${site}${src}` : src))
  const price = currentPrice(product)
  const data: Record<string, unknown> = { "@context": "https://schema.org", "@type": "Product", name: product.title, url, image: images, brand: { "@type": "Brand", name: storeName } }
  const description = detail.shortDescription || stripTags(detail.descriptionHtml)
  if (description) data.description = description.slice(0, 500)
  if (detail.sku) data.sku = detail.sku
  if (price !== null) {
    data.offers = { "@type": "Offer", url, priceCurrency: "COP", price, itemCondition: "https://schema.org/NewCondition",
      availability: `https://schema.org/${detail.availability.status === "OUT_OF_STOCK" ? "OutOfStock" : detail.availability.status === "BACKORDER" ? "BackOrder" : "InStock"}` }
  }
  if (detail.rating.count > 0) data.aggregateRating = { "@type": "AggregateRating", ratingValue: Number(detail.rating.average.toFixed(1)), reviewCount: detail.rating.count }
  return data
}

export function breadcrumbJsonLd(detail: ProductDetail, site: string): Record<string, unknown> {
  const items = [{ name: "Productos", url: `${site}/productos` }, ...detail.breadcrumbs.map((crumb) => ({ name: crumb.name, url: `${site}/productos?categoria=${encodeURIComponent(crumb.slug)}` })), { name: detail.product.title, url: `${site}/producto/${encodeURIComponent(detail.product.slug)}` }]
  return { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.name, item: item.url })) }
}

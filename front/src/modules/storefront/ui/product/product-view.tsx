import Link from "next/link"
import { ArrowRight, Cake, CaretRight, CreditCard, Hash, MapPin, Package, ShieldCheck } from "@phosphor-icons/react/ssr"
import { discountPercent } from "../../domain/catalog"
import { purchaseFactsFor } from "../../domain/home"
import type { StoreProfile } from "../../../shared/domain/store-profile"
import { type ProductDetail, ageLabel } from "../../domain/product"
import { ProductCard } from "../catalog/product-card"
import { Reveal } from "../reveal"
import { StoreHeader } from "../store-header"
import { BuyPanel } from "./buy-panel"
import { ProductGallery } from "./product-gallery"
import { ProductInfo, type ProductPanel } from "./product-info"
import { Stars } from "./stars"

const factIcons = { shipping: Package, payment: CreditCard, warranty: ShieldCheck, store: MapPin } as const

/**
 * The product page: photos, price and buying first; below, everything else in one box of tabs (folding rows on a
 * phone), so the page does not open with every detail at once. Sections the administrator hid do not arrive from the
 * store, so each tab is there only when it is both shown and has something to say. `reviews` and `questions` are the
 * conversation panels, rendered by the page.
 */
export function ProductView({ detail, profile, reviews, questions }: { detail: ProductDetail; profile: StoreProfile; reviews?: React.ReactNode; questions?: React.ReactNode }) {
  const shipsFrom = profile.localCity
  const { product, sections } = detail
  const age = ageLabel(detail.ageMin, detail.ageMax)
  const discount = discountPercent(product)
  const hasSheet = detail.specs.length > 0 || Boolean(detail.sku) || Boolean(age) || detail.categories.length > 0
  const panels: ProductPanel[] = []
  if (detail.descriptionHtml) panels.push({ id: "descripcion", label: "Descripción", content: <div className="product-description" dangerouslySetInnerHTML={{ __html: detail.descriptionHtml }} /> })
  if (hasSheet) panels.push({ id: "ficha", label: "Ficha", content: (
    <dl className="product-sheet">
      {detail.specs.map((spec) => <div key={spec.label}><dt>{spec.label}</dt><dd>{spec.value}</dd></div>)}
      {age && <div><dt>Edad recomendada</dt><dd>{age}</dd></div>}
      {detail.sku && <div><dt><Hash size={14} aria-hidden="true" /> Referencia</dt><dd>{detail.sku}</dd></div>}
      {detail.categories.length > 0 && (
        <div><dt>Categorías</dt><dd className="product-tags">{detail.categories.map((category) => <Link key={category.slug} href={`/productos?categoria=${encodeURIComponent(category.slug)}`}>{category.name}</Link>)}</dd></div>
      )}
    </dl>
  ) })
  if (sections.shipping) panels.push({ id: "envio", label: "Envío y pago", content: (
    <ul className="product-facts">
      {purchaseFactsFor(profile).map((fact) => {
        const Icon = factIcons[fact.id]
        return <li key={fact.id} data-tone={fact.tone}><span className="product-fact-icon squircle"><Icon size={20} weight="fill" aria-hidden="true" /></span><div><h3>{fact.title}</h3><p>{fact.text}</p></div></li>
      })}
    </ul>
  ) })
  if (sections.reviews && reviews) panels.push({ id: "opiniones", label: "Opiniones", count: detail.rating.count, content: reviews })
  if (sections.questions && questions) panels.push({ id: "preguntas", label: "Preguntas", content: questions })

  return (
    <main id="contenido" className="storefront catalog product-page">
      <StoreHeader />

      <div className="product-top">
        <nav className="crumbs" aria-label="Ruta del producto">
          <ol>
            <li><Link href="/productos">Productos</Link></li>
            {detail.breadcrumbs.map((crumb) => (
              <li key={crumb.slug}><CaretRight size={12} weight="bold" aria-hidden="true" /><Link href={`/productos?categoria=${encodeURIComponent(crumb.slug)}`}>{crumb.name}</Link></li>
            ))}
            <li aria-current="page"><CaretRight size={12} weight="bold" aria-hidden="true" /><span>{product.title}</span></li>
          </ol>
        </nav>

        <div className="product-hero">
          <ProductGallery productId={product.id} title={product.title} images={detail.images}
            badges={<>{discount !== null && <span className="badge badge-sale">-{discount}%</span>}{product.featured && <span className="badge badge-featured">Destacado</span>}</>} />

          <section className="product-summary" aria-labelledby="product-title">
            <h1 id="product-title">{product.title}</h1>
            {sections.reviews && detail.rating.count > 0 ? (
              <a className="product-rating" href="#opiniones"><Stars value={detail.rating.average} /> <span>{detail.rating.average.toLocaleString("es-CO", { maximumFractionDigits: 1 })} · {detail.rating.count} {detail.rating.count === 1 ? "opinión" : "opiniones"}</span></a>
            ) : (
              <p className="product-proof"><Package size={18} weight="fill" aria-hidden="true" /> Envíos a toda Colombia{shipsFrom ? ` desde ${shipsFrom}` : ""}</p>
            )}
            {detail.shortDescription && <p className="product-lead">{detail.shortDescription}</p>}
            {age && <p className="product-age"><Cake size={18} weight="fill" aria-hidden="true" /> {age}</p>}
            <BuyPanel detail={detail} />
            {detail.highlights.length > 0 && (
              <ul className="product-highlights">{detail.highlights.map((highlight) => <li key={highlight}>{highlight}</li>)}</ul>
            )}
          </section>
        </div>
      </div>

      <div className="product-body">
        <ProductInfo panels={panels} label={`Detalles de ${product.title}`} />

        {detail.related.length > 0 && (
          <Reveal as="section" className="product-block">
            <div className="product-block-head">
              <h2>También te puede servir</h2>
              {detail.breadcrumbs.length > 0 && <Link href={`/productos?categoria=${encodeURIComponent(detail.breadcrumbs[detail.breadcrumbs.length - 1].slug)}`} className="link-arrow">Ver la categoría <ArrowRight size={18} weight="bold" aria-hidden="true" /></Link>}
            </div>
            <div className="product-grid product-related">{detail.related.map((item, index) => <ProductCard key={item.id} product={item} index={index} />)}</div>
          </Reveal>
        )}
      </div>

    </main>
  )
}

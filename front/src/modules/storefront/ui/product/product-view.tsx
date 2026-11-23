import Link from "next/link"
import { ArrowRight, Cake, CaretRight, CreditCard, Hash, MapPin, Package, ShieldCheck } from "@phosphor-icons/react/ssr"
import { discountPercent } from "../../domain/catalog"
import { manifesto, purchaseFacts } from "../../domain/home"
import { type ProductDetail, ageLabel } from "../../domain/product"
import { ProductCard } from "../catalog/product-card"
import { SiteFooter } from "../home/final-cta"
import { Reveal } from "../reveal"
import { StoreHeader } from "../store-header"
import { BuyPanel } from "./buy-panel"
import { ProductGallery } from "./product-gallery"
import { Stars } from "./stars"

const factIcons = { shipping: Package, payment: CreditCard, warranty: ShieldCheck, store: MapPin } as const

/**
 * The product page. Sections the administrator hid do not arrive from the store, so each block renders only when it
 * is both shown and has something to say. `children` is where the reviews and questions go.
 */
/** shipsFrom is the store's city, from its profile; empty, the line only says it ships to all of Colombia. */
export function ProductView({ detail, shipsFrom = "", children }: { detail: ProductDetail; shipsFrom?: string; children?: React.ReactNode }) {
  const { product, sections } = detail
  const age = ageLabel(detail.ageMin, detail.ageMax)
  const discount = discountPercent(product)
  const hasSheet = detail.specs.length > 0 || Boolean(detail.sku) || Boolean(age) || detail.categories.length > 0

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

      <Reveal as="section" className="product-tagline">
        <p className="eyebrow">{manifesto.eyebrow}</p>
        <p className="product-tagline-lines"><span>{manifesto.lines[0]}</span><span>{manifesto.lines[1]}</span></p>
      </Reveal>

      <div className="product-body">
        {(detail.descriptionHtml || hasSheet) && (
          <div className="product-columns">
            {detail.descriptionHtml && (
              <Reveal as="section" className="product-block">
                <h2>Descripción</h2>
                <div className="product-description" dangerouslySetInnerHTML={{ __html: detail.descriptionHtml }} />
              </Reveal>
            )}
            {hasSheet && (
              <Reveal as="section" className="product-block">
                <h2>Ficha del producto</h2>
                <dl className="product-sheet">
                  {detail.specs.map((spec) => <div key={spec.label}><dt>{spec.label}</dt><dd>{spec.value}</dd></div>)}
                  {age && <div><dt>Edad recomendada</dt><dd>{age}</dd></div>}
                  {detail.sku && <div><dt><Hash size={14} aria-hidden="true" /> Referencia</dt><dd>{detail.sku}</dd></div>}
                  {detail.categories.length > 0 && (
                    <div><dt>Categorías</dt><dd className="product-tags">{detail.categories.map((category) => <Link key={category.slug} href={`/productos?categoria=${encodeURIComponent(category.slug)}`}>{category.name}</Link>)}</dd></div>
                  )}
                </dl>
              </Reveal>
            )}
          </div>
        )}

        {sections.shipping && (
          <Reveal as="section" className="product-block">
            <h2>Cómo lo recibes</h2>
            <ul className="product-facts">
              {purchaseFacts.map((fact) => {
                const Icon = factIcons[fact.id]
                return <li key={fact.id} className="squircle" data-tone={fact.tone}><span className="product-fact-icon squircle"><Icon size={24} weight="fill" aria-hidden="true" /></span><h3>{fact.title}</h3><p>{fact.text}</p></li>
              })}
            </ul>
          </Reveal>
        )}

        {children}

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

      <SiteFooter />
    </main>
  )
}

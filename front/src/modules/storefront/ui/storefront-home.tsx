import type { CatalogCategory, CatalogProduct } from "../domain/catalog"
import { formatCount } from "../domain/catalog"
import { AskTeaser } from "./home/ask-teaser"
import { Benefits } from "./home/benefits"
import { Faq } from "./home/faq"
import { Favorites } from "./home/favorites"
import { FinalCta } from "./home/final-cta"
import { HowItWorks } from "./home/how-it-works"
import { Manifesto } from "./home/manifesto"
import { SiteHeader } from "./home/site-header"
import { SmoothScroll } from "./home/smooth-scroll"
import { Worlds } from "./home/worlds"
import { ScrollWorld } from "./scroll-world"

export type StorefrontHomeProps = {
  categories: CatalogCategory[]
  favorites: CatalogProduct[]
  /** True when `favorites` are the real best sellers, false when they are just a first look at the catalog. */
  ranked: boolean
  productCount: number
}

/** The home: the scroll story, then one chapter per question a shopper has. Catalog chapters drop out when the catalog is unreachable. */
export function StorefrontHome({ categories, favorites, ranked, productCount }: StorefrontHomeProps) {
  return (
    <main id="contenido" className="storefront">
      <SmoothScroll />
      <SiteHeader />
      <ScrollWorld proof={productCount > 0 ? `${formatCount(productCount)} productos y envíos a toda Colombia` : undefined} />
      <Manifesto />
      {favorites.length > 0 && <Favorites products={favorites} ranked={ranked} />}
      {categories.length > 0 && <Worlds categories={categories} />}
      <Benefits productCount={productCount} categoryCount={categories.length} />
      <HowItWorks product={ranked ? favorites[0]?.title : undefined} />
      <AskTeaser />
      <Faq />
      <FinalCta categories={categories} />
    </main>
  )
}

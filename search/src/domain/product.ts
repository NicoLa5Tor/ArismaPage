import { EMPTY_TAXONOMY, type Taxonomy, statedBands } from "./taxonomy.js"

/** A published product as the store shows it (prices include tax; null when hidden). Mirrors the Quarkus public catalog. */
export type ShopProduct = {
  id: string
  title: string
  slug: string
  price: number | null
  salePrice: number | null
  quoteOnly: boolean
  inStock: boolean
  featured: boolean
  imageId: string | null
  imageUrl: string | null
  imageUploaded: boolean
}

/** What the index keeps per product: the shop card plus the text that describes it. */
export type IndexedProduct = ShopProduct & {
  description: string
  categories: string[]
  categorySlugs: string[]
  /** Other words shoppers use for it ("puzzle"), set by the store on the product or on its categories. */
  keywords: string[]
  /** The ages it is for, when the store states them on the product or on its categories. */
  age: { min: number; max: number } | null
}

/** Price the shopper pays now, or null when it must be quoted. */
export const payablePrice = (product: ShopProduct): number | null =>
  product.quoteOnly || product.price === null ? null : product.salePrice ?? product.price

/** e5-small reads at most 512 tokens; 1.200 characters of Spanish stay well inside that. The measured form used it. */
const MAX_PASSAGE = 1200

/**
 * The text the meaning model reads for a product: the title twice (so the name weighs most), then its categories and
 * the words shoppers use for it, then the description, as one running text.
 *
 * Measured with scripts/compare-index.ts on 94 searches: labelled lines ("Categoría: …", "Edad: …"), a category path
 * or the age added here all ranked the first right product lower (MRR 86 to 89 % against 90,7 % with meaning only),
 * so the plain form stays. The `taxonomy` argument is kept for variants that need it.
 */
export function passageOf(product: IndexedProduct, _taxonomy: Taxonomy = EMPTY_TAXONOMY): string {
  return `passage: ${product.title}. ${product.title}. ${[...product.categories, ...product.keywords].join(", ")}. ${product.description}`.slice(0, MAX_PASSAGE)
}

/**
 * Each category of the product as a path from the top of the store ("Didácticos > Juegos > Rompecabezas en madera").
 * Only the deepest ones are kept, since their path already names the parents; age ranges are left to the age line.
 */
export function categoryPaths(slugs: string[], taxonomy: Taxonomy): string[][] {
  const ages = new Set(statedBands(taxonomy).map((band) => band.slug))
  const own = new Set(slugs.filter((slug) => taxonomy.bySlug.has(slug) && !ages.has(slug)))
  const leaves = [...own].filter((slug) => ![...own].some((other) => taxonomy.bySlug.get(other)?.parentSlug === slug))
  const paths = leaves.map((leaf) => {
    const path: string[] = []
    for (let current = taxonomy.bySlug.get(leaf), guard = 0; current && guard < 20; current = current.parentSlug ? taxonomy.bySlug.get(current.parentSlug) : undefined, guard++) path.unshift(current.name)
    return path
  })
  return paths.sort((a, b) => b.length - a.length).slice(0, 4)
}

/** The ages a product is for: what the store set, otherwise the span of the age ranges among its categories. */
export function ageOfProduct(product: IndexedProduct, taxonomy: Taxonomy): { min: number; max: number } | null {
  if (product.age) return product.age
  const bands = taxonomy.ageBands.filter((band) => product.categorySlugs.includes(band.slug))
  return bands.length ? { min: Math.min(...bands.map((b) => b.min)), max: Math.max(...bands.map((b) => b.max)) } : null
}

export const ageInWords = ({ min, max }: { min: number; max: number }) =>
  max >= 99 ? `desde ${min} años` : min === max ? `${min} ${min === 1 ? "año" : "años"}` : `de ${min} a ${max} años`

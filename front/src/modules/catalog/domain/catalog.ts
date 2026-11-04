export type ProductStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED"
export type StockStatus = "INSTOCK" | "OUTOFSTOCK" | "ONBACKORDER"
export type Backorders = "NO" | "NOTIFY" | "YES"
/** Prices are tax-exclusive, as stored; the *WithTax values are what customers pay. */
export type Product = {
  id: string; title: string; slug: string; status: ProductStatus; sku: string | null
  regularPrice: number | null; salePrice: number | null; saleStartsAt: string | null; saleEndsAt: string | null; taxRateId: string | null
  manageStock: boolean; stockQuantity: number | null; stockStatus: StockStatus; backorders: Backorders; quoteOnly: boolean; hidePrice: boolean; featured: boolean
  taxPercent: number | null; regularPriceWithTax: number | null; salePriceWithTax: number | null; saleActive: boolean; unitsSold: number; imageId: string | null; imageUrl: string | null
}
export type Category = { id: string; name: string; slug: string; description: string; parentId: string | null }
/** Gallery image; position 0 is the primary one. Historical photos still live on the old site (originalUrl). */
export type ProductImage = { id: string; uploaded: boolean; originalUrl: string | null; alt: string; isPrimary: boolean; position: number; contentType: string | null; byteSize: number | null; createdAt: string }
export type TaxRate = { id: string; code: string; name: string; percent: number; active: boolean; products?: number }

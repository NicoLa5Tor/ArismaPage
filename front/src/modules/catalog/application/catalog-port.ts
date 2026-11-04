import type { Category, Product, ProductImage, ProductStatus, TaxRate } from "../domain/catalog"

export type ProductChange = Omit<Product, "id" | "taxPercent" | "regularPriceWithTax" | "salePriceWithTax" | "saleActive" | "unitsSold" | "imageId" | "imageUrl"> & { stockReason: string }
export type TaxRateChange = Omit<TaxRate, "id" | "products">
export interface CatalogPort {
  listProducts(query: string, offset: number, status: ProductStatus | "", limit: number): Promise<Product[]>
  saveProduct(id: string | null, product: ProductChange, csrf: string): Promise<Product>
  listCategories(): Promise<Category[]>
  saveCategory(category: Category, csrf: string): Promise<void>
  listProductCategories(id: string): Promise<string[]>
  saveProductCategories(id: string, categories: string[], csrf: string): Promise<void>
  getProduct(id: string): Promise<Product>
  /** Gallery operations answer with the whole gallery in its new order. */
  listImages(id: string): Promise<ProductImage[]>
  uploadImage(id: string, file: Blob, alt: string, csrf: string): Promise<ProductImage[]>
  setPrimaryImage(id: string, imageId: string, csrf: string): Promise<ProductImage[]>
  reorderImages(id: string, order: string[], csrf: string): Promise<ProductImage[]>
  describeImage(id: string, imageId: string, alt: string, csrf: string): Promise<ProductImage[]>
  deleteImage(id: string, imageId: string, csrf: string): Promise<ProductImage[]>
  listTaxRates(): Promise<TaxRate[]>
  saveTaxRate(id: string | null, rate: TaxRateChange, csrf: string): Promise<TaxRate>
}

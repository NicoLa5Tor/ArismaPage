import type { Category, Product, ProductImage, ProductStatus, TaxRate } from "../domain/catalog"
import type { ProductSearchProfile, SearchProfile } from "../domain/search-profile"
import type { ProductPage } from "../domain/product-page"

export type ProductChange = Omit<Product, "id" | "taxPercent" | "regularPriceWithTax" | "salePriceWithTax" | "saleActive" | "unitsSold" | "imageId" | "imageUrl"> & { stockReason: string }
export type TaxRateChange = Omit<TaxRate, "id" | "products">
export interface CatalogPort {
  listProducts(query: string, offset: number, status: ProductStatus | "", limit: number): Promise<Product[]>
  saveProduct(id: string | null, product: ProductChange, csrf: string): Promise<Product>
  listCategories(): Promise<Category[]>
  /** Answers with the saved category, so a new one comes back with its id. */
  saveCategory(category: Category, csrf: string): Promise<Category>
  /** Keywords and age range: a category's are inherited by its products; a product's own age wins. */
  getCategorySearch(id: string): Promise<SearchProfile>
  saveCategorySearch(id: string, profile: SearchProfile, csrf: string): Promise<SearchProfile>
  getProductSearch(id: string): Promise<ProductSearchProfile>
  saveProductSearch(id: string, profile: SearchProfile, csrf: string): Promise<ProductSearchProfile>
  /** What the public page says and which sections it shows. The description comes back already cleaned. */
  getProductPage(id: string): Promise<ProductPage>
  saveProductPage(id: string, page: ProductPage, csrf: string): Promise<ProductPage>
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

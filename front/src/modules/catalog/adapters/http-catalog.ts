import { type CatalogPort } from "../application/catalog-port"
import { json, qs, request, seg } from "../../shared/adapters/http-client"

export const httpCatalog: CatalogPort = {
  listProducts(q, offset, status, limit) { return request(`/products?${qs({ q, status, limit, offset })}`) },
  saveProduct(id, product, csrf) { return request(`/products${id ? `/${seg(id)}` : ""}`, json(id ? "PUT" : "POST", product, csrf)) },
  listCategories() { return request("/categories") },
  saveCategory(category, csrf) { return request(`/categories${category.id ? `/${seg(category.id)}` : ""}`, json(category.id ? "PUT" : "POST", category, csrf)) },
  listProductCategories(id) { return request(`/products/${seg(id)}/categories`) },
  saveProductCategories(id, categories, csrf) { return request(`/products/${seg(id)}/categories`, json("PUT", categories, csrf)) },
  getProduct(id) { return request(`/products/${seg(id)}`) },
  listImages(id) { return request(`/products/${seg(id)}/images`) },
  uploadImage(id, file, alt, csrf) { return request(`/products/${seg(id)}/images?${qs({ alt })}`, { method: "POST", headers: { "Content-Type": "application/octet-stream", "X-CSRF-Token": csrf }, body: file }) },
  setPrimaryImage(id, imageId, csrf) { return request(`/products/${seg(id)}/images/${seg(imageId)}/primary`, { method: "POST", headers: { "X-CSRF-Token": csrf } }) },
  reorderImages(id, order, csrf) { return request(`/products/${seg(id)}/images/order`, json("PUT", order, csrf)) },
  describeImage(id, imageId, alt, csrf) { return request(`/products/${seg(id)}/images/${seg(imageId)}`, json("PUT", { alt }, csrf)) },
  deleteImage(id, imageId, csrf) { return request(`/products/${seg(id)}/images/${seg(imageId)}`, { method: "DELETE", headers: { "X-CSRF-Token": csrf } }) },
  listTaxRates() { return request("/tax-rates") },
  saveTaxRate(id, rate, csrf) { return request(`/tax-rates${id ? `/${seg(id)}` : ""}`, json(id ? "PUT" : "POST", rate, csrf)) },
}

import type { MetadataRoute } from "next"
import { httpStoreProfile } from "../modules/shared/adapters/http-store-profile"
import { siteUrl } from "../modules/shared/domain/store-profile"

/** Search engines read the store; the panel, the account, the cart, checkout, orders, invoices and the API stay out. */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const site = siteUrl(await httpStoreProfile.load())
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/cuenta", "/checkout", "/carrito", "/pedido", "/factura", "/api", "/callback"] },
    sitemap: `${site}/sitemap.xml`,
  }
}

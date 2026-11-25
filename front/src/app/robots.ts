import type { MetadataRoute } from "next"
import { httpStoreProfile } from "../modules/shared/adapters/http-store-profile"
import { indexable, siteUrl } from "../modules/shared/domain/store-profile"

/**
 * Search engines read the store; the panel, the account, the cart, checkout, orders, invoices and the API stay out.
 * A copy of the store away from its own address (a beta, a test server) keeps them out entirely.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const profile = await httpStoreProfile.load()
  if (!indexable(profile)) return { rules: { userAgent: "*", disallow: "/" } }
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/cuenta", "/checkout", "/carrito", "/pedido", "/factura", "/api", "/callback"] },
    sitemap: `${siteUrl(profile)}/sitemap.xml`,
  }
}

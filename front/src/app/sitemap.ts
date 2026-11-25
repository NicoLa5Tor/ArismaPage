import type { MetadataRoute } from "next"
import { httpPublicCatalog } from "../modules/storefront/adapters/http-public-catalog"
import { httpStoreProfile } from "../modules/shared/adapters/http-store-profile"
import { LEGAL_KINDS, LEGAL_PATHS } from "../modules/shared/domain/legal"
import { siteUrl } from "../modules/shared/domain/store-profile"

export const revalidate = 3600
const MAX_PAGES = 200

/** Every public page of the store: home, catalog, each published product and each legal page the store published. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const profile = await httpStoreProfile.load()
  const site = siteUrl(profile)
  const entries: MetadataRoute.Sitemap = [
    { url: `${site}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${site}/productos`, changeFrequency: "daily", priority: 0.9 },
    { url: `${site}/buscar`, changeFrequency: "monthly", priority: 0.5 },
  ]
  for (const kind of LEGAL_KINDS) if (profile.legal[kind]) entries.push({ url: `${site}${LEGAL_PATHS[kind]}`, changeFrequency: "yearly", priority: 0.2 })
  try {
    const filters = { q: "", category: "", sort: "novedades" as const, offers: false, priced: false, exact: false }
    const first = await httpPublicCatalog.products({ ...filters, pages: 1 })
    const pages = Math.min(Math.ceil(first.total / Math.max(first.pageSize, 1)), MAX_PAGES)
    const rest = pages > 1 ? await httpPublicCatalog.products({ ...filters, pages }) : first
    for (const product of rest.items) entries.push({ url: `${site}/producto/${encodeURIComponent(product.slug)}`, changeFrequency: "weekly", priority: 0.7 })
  } catch { /* the catalog is unreachable: the sitemap still lists the store's own pages */ }
  return entries
}

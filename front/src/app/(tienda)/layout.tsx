import type { Metadata } from "next"
import { httpStoreProfile } from "../../modules/shared/adapters/http-store-profile"
import { siteUrl } from "../../modules/shared/domain/store-profile"
import { StoreProviders } from "./store-providers"
import { StoreFooter } from "../../modules/storefront/ui/store-footer"

/**
 * Every page title ends with the store's name, as the store keeps it in its profile. Relative canonical addresses and
 * images resolve against the store's own address, and a page without its own description says who the store is.
 */
export async function generateMetadata(): Promise<Metadata> {
  const profile = await httpStoreProfile.load()
  const description = `Compra en línea en ${profile.name}${profile.localCity ? `, ${profile.localCity}` : ""}. Envíos a toda Colombia.`
  return {
    metadataBase: new URL(siteUrl(profile)),
    title: { template: `%s | ${profile.name}`, default: profile.name },
    description,
    openGraph: { siteName: profile.name, locale: "es_CO", type: "website", description },
    twitter: { card: "summary_large_image" },
  }
}

/** Every public store page shares the cart and the store profile; the administration panel lives outside this group. */
export default async function StoreLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const profile = await httpStoreProfile.load()
  return <StoreProviders profile={profile}>{children}<StoreFooter /></StoreProviders>
}

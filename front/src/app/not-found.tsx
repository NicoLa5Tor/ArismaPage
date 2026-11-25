import type { Metadata } from "next"
import { httpStoreProfile } from "../modules/shared/adapters/http-store-profile"
import { StoreFooter } from "../modules/storefront/ui/store-footer"
import { StoreMissing } from "../modules/storefront/ui/errors/store-missing"
import { StoreProviders } from "./(tienda)/store-providers"
import { httpErrorPages } from "../modules/shared/adapters/http-legal"

export const metadata: Metadata = { title: "No encontramos esta página", robots: { index: false, follow: true } }

/** Any address that matches no page at all: the store's 404, with its header and footer. */
export default async function NotFound() {
  const [profile, custom] = await Promise.all([httpStoreProfile.load(), httpErrorPages.load("not_found")])
  return <StoreProviders profile={profile}><StoreMissing custom={custom} /><StoreFooter /></StoreProviders>
}

import type { Metadata } from "next"
import { httpStoreProfile } from "../../modules/shared/adapters/http-store-profile"
import { StoreProviders } from "./store-providers"

/** Every page title ends with the store's name, as the store keeps it in its profile. */
export async function generateMetadata(): Promise<Metadata> {
  const profile = await httpStoreProfile.load()
  return { title: { template: `%s | ${profile.name}`, default: profile.name } }
}

/** Every public store page shares the cart and the store profile; the administration panel lives outside this group. */
export default async function StoreLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const profile = await httpStoreProfile.load()
  return <StoreProviders profile={profile}>{children}</StoreProviders>
}

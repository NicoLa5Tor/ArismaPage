import type { Metadata } from "next"
import { StoreMissing } from "../../modules/storefront/ui/errors/store-missing"
import { httpErrorPages } from "../../modules/shared/adapters/http-legal"

export const metadata: Metadata = { title: "No encontramos esta página", robots: { index: false, follow: true } }

/** A store page that does not exist (a product removed, a category renamed). */
export default async function StoreNotFound() { return <StoreMissing custom={await httpErrorPages.load("not_found")} /> }

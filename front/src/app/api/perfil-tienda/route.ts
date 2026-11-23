import { httpStoreProfile } from "../../../modules/shared/adapters/http-store-profile"

// The store profile for pages that load it in the browser (the panel). Public data, fixed host.
export async function GET() {
  return Response.json(await httpStoreProfile.load(), { headers: { "Cache-Control": "public, max-age=60" } })
}

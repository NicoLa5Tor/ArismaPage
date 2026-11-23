import type { StoreProfilePort } from "../application/store-profile-port"
import { EMPTY_PROFILE, type StoreProfile } from "../domain/store-profile"

// Server side: straight to the backend. Browser side: through the Next.js route /api/perfil-tienda.
const base = () => process.env.ARISMA_ADMIN_API_URL || "http://127.0.0.1:9001"

export const httpStoreProfile: StoreProfilePort = {
  async load() {
    const server = typeof window === "undefined"
    try {
      const response = server
        ? await fetch(new URL("/api/public/store", base()), { next: { revalidate: 60 } })
        : await fetch("/api/perfil-tienda", { cache: "no-store" })
      if (!response.ok) return EMPTY_PROFILE
      return { ...EMPTY_PROFILE, ...(await response.json() as Partial<StoreProfile>) }
    } catch { return EMPTY_PROFILE }
  },
}

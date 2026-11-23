import type { LegalPort } from "../application/legal-port"
import type { LegalPage } from "../domain/legal"

// Server side only: straight to the backend, like the store profile.
const base = () => process.env.ARISMA_ADMIN_API_URL || "http://127.0.0.1:9001"

export const httpLegal: LegalPort = {
  async load(kind) {
    try {
      const response = await fetch(new URL(`/api/public/store/legal/${kind}`, base()), { next: { revalidate: 60 } })
      if (!response.ok) return null
      const page = await response.json() as Partial<LegalPage>
      // only the documents the store can serve right now, so the page never shows a broken frame
      const documents = (await Promise.all((page.documents ?? []).map(async (document) => (await documentReady(document.file)) ? document : null))).filter((d) => d !== null)
      return { title: page.title ?? "", blocks: page.blocks ?? [], documents }
    } catch { return null }
  },
}

async function documentReady(file: string): Promise<boolean> {
  try {
    const response = await fetch(new URL(`/api/public/store/legal/files/${encodeURIComponent(file)}`, base()), { method: "HEAD", next: { revalidate: 60 } })
    return response.ok
  } catch { return false }
}

/** A document a legal page attaches, read from the backend; null when it is missing or the store cannot be reached. */
export async function loadLegalDocument(file: string): Promise<Response | null> {
  try {
    const response = await fetch(new URL(`/api/public/store/legal/files/${encodeURIComponent(file)}`, base()), { next: { revalidate: 300 } })
    return response.ok ? response : null
  } catch { return null }
}

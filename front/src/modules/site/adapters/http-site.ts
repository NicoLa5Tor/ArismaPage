import type { SitePort } from "../application/site-port"
import { json, qs, request, seg } from "../../shared/adapters/http-client"

export const httpSite: SitePort = {
  legal: () => request("/site/legal"),
  saveDraft: (kind, page, csrf) => request(`/site/legal/${seg(kind)}`, json("PUT", page, csrf)),
  generateDraft: (kind, csrf) => request(`/site/legal/${seg(kind)}/draft`, json("POST", {}, csrf)),
  publish: (kind, csrf) => request(`/site/legal/${seg(kind)}/publish`, json("POST", {}, csrf)),
  async uploadPdf(name, file, csrf) {
    const saved = await request<{ file: string }>(`/site/legal/files?${qs({ name })}`, { method: "POST", headers: { "Content-Type": "application/pdf", "X-CSRF-Token": csrf }, body: file })
    return saved.file
  },
  pdfHref: (file) => `/api/arisma-admin/site/legal/files/${seg(file)}`,
  errorPages: () => request("/site/error-pages"),
  saveErrorPage: (kind, page, csrf) => request(`/site/error-pages/${seg(kind)}`, json("PUT", page, csrf)),
}

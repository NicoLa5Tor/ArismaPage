import { loadLegalDocument } from "../../../../modules/shared/adapters/http-legal"

// The PDFs the legal pages attach, served from the store's own storage. Only names the backend knows are answered.
export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params
  if (!/^[a-z0-9][a-z0-9-]{0,80}\.pdf$/.test(file)) return new Response("No encontrado", { status: 404 })
  const stored = await loadLegalDocument(file)
  if (!stored) return new Response("Este documento no está disponible en este momento", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } })
  return new Response(stored.body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${file}"`,
      "Cache-Control": "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  })
}

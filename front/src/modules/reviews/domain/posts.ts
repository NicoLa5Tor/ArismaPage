// Reviews and questions on a product, as the store shows them.

export type PostKind = "review" | "question"
export type Reply = { id: string; staff: boolean; authorName: string; body: string; createdAt: string }
export type Post = { id: string; kind: PostKind; rating: number | null; body: string; authorName: string; verifiedPurchase: boolean; createdAt: string; replies: Reply[] }
/** `stars[0]` is how many reviews gave one star. */
export type Summary = { average: number; count: number; stars: number[] }
export type PostList = { posts: { items: Post[]; total: number; page: number; pageSize: number }; summary: Summary; open: boolean }
/** "pending" means it waits for the store's approval before anyone else sees it. */
export type Submitted = { id: string; status: "pending" | "published" }

export const LIMITS = { review: { min: 10, max: 2000 }, question: { min: 8, max: 600 } } as const

export function bodyError(kind: PostKind, body: string): string | null {
  const text = body.trim(), limit = LIMITS[kind]
  if (text.length < limit.min) return kind === "review" ? `Cuéntanos un poco más (mínimo ${limit.min} caracteres)` : `Escribe tu pregunta (mínimo ${limit.min} caracteres)`
  if (text.length > limit.max) return `Máximo ${limit.max} caracteres`
  if (/https?:\/\/|www\./i.test(text)) return "No se permiten enlaces"
  return null
}

export const ratingWords = ["", "Malo", "Regular", "Bueno", "Muy bueno", "Excelente"] as const

const dates = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Bogota" })
export const formatDate = (iso: string) => dates.format(new Date(iso))

/** Share of reviews with each number of stars, five first, as whole percentages. */
export function distribution(summary: Summary): { stars: number; count: number; percent: number }[] {
  return [5, 4, 3, 2, 1].map((stars) => { const count = summary.stars[stars - 1] ?? 0; return { stars, count, percent: summary.count ? Math.round((count / summary.count) * 100) : 0 } })
}

// What helps shoppers find a category or a product: the words they use for it and the ages it is for.
// The rules mirror the back's SearchProfile, so a mistake is caught while typing instead of on save.

export type SearchProfile = { keywords: string[]; ageMin: number | null; ageMax: number | null }
/** A product's own profile plus what it takes from its categories (shown, never edited here). */
export type ProductSearchProfile = SearchProfile & { inheritedKeywords: string[]; inheritedAgeMin: number | null; inheritedAgeMax: number | null }

export const MAX_KEYWORDS = 40
const MIN_LENGTH = 2
const MAX_LENGTH = 40
const MAX_AGE = 99
/** Checked after lower-casing. The back accepts letters of any alphabet; the panel sticks to Spanish ones. */
const ALLOWED = /^[a-z0-9áéíóúüñ]+( [a-z0-9áéíóúüñ]+)*$/

/** The keyword as it will be stored, or why it cannot be. */
export function cleanKeyword(raw: string): { keyword: string } | { error: string } {
  const keyword = raw.trim().replace(/\s+/g, " ").toLowerCase()
  if (keyword.length < MIN_LENGTH) return { error: `Escribe al menos ${MIN_LENGTH} letras` }
  if (keyword.length > MAX_LENGTH) return { error: `Máximo ${MAX_LENGTH} caracteres por palabra clave` }
  if (!ALLOWED.test(keyword)) return { error: "Solo letras, números y espacios" }
  return { keyword }
}

/** The form holds ages as text; both empty means "no age range". */
export type AgeDraft = { ageMin: string; ageMax: string }
export const ageDraft = (profile: Pick<SearchProfile, "ageMin" | "ageMax">): AgeDraft => ({ ageMin: profile.ageMin?.toString() ?? "", ageMax: profile.ageMax?.toString() ?? "" })

export function ageError({ ageMin, ageMax }: AgeDraft): string | null {
  if (ageMin === "" && ageMax === "") return null
  if (ageMin === "" || ageMax === "") return "Indica la edad desde y hasta, o deja las dos vacías"
  const min = Number(ageMin), max = Number(ageMax)
  if (!Number.isInteger(min) || !Number.isInteger(max) || min < 0 || max > MAX_AGE) return `La edad va de 0 a ${MAX_AGE} años, en números enteros`
  return min > max ? "La edad desde no puede ser mayor que la edad hasta" : null
}

export const toProfile = (keywords: string[], age: AgeDraft): SearchProfile => ({ keywords, ageMin: age.ageMin === "" ? null : Number(age.ageMin), ageMax: age.ageMax === "" ? null : Number(age.ageMax) })

export const ageLabel = (min: number | null, max: number | null) => (min == null || max == null ? null : min === max ? `${min} años` : max >= MAX_AGE ? `desde ${min} años` : `${min} a ${max} años`)

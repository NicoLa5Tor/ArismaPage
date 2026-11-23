// How sure the search is that the shopper named one product in particular, and so how many results are worth showing.
//
// Measured with scripts/calibrate.ts on the phrase bank (scripts/phrases.ts): closeness in meaning does not tell a
// precise name from a general ask (exact names scored 0.875 to 0.933, general ones 0.820 to 0.911), so it is not used
// here. What does tell them apart is how many product names carry every word asked for: 1 for each of the ten exact
// names in the bank, against 458 for "rompecabezas de madera" or 93 for "títeres".

/** At most this many names carrying every word asked for still means the shopper is pointing at them. */
export const PRECISE_MATCHES = 3
/** A precise ask shows the matches and, after them, the closest others up to this many. */
export const PRECISE_SHOWN = 4

/**
 * "exact" when the shopper named one product (or a handful): two or more meaningful words, all of them in the names
 * of 1 to 3 products, and not just the name of a category ("cuentos infantiles" is a shelf, not a product).
 */
export function precision(asked: string[], matching: number, namedCategory: boolean): "exact" | "broad" {
  return asked.length >= 2 && !namedCategory && matching >= 1 && matching <= PRECISE_MATCHES ? "exact" : "broad"
}

/** Share of the words asked for that appear in a product's name, as a whole percentage (shown while thinking). */
export function nameCoverage(asked: string[], nameWords: Set<string>, forms: (word: string) => string[]): number {
  if (!asked.length) return 0
  return Math.round((asked.filter((word) => forms(word).some((form) => nameWords.has(form))).length / asked.length) * 100)
}

// Reads intent out of a free-text search, without AI: age, budget, offers and any category named in it.
// Categories and age bands come from the live catalog (Taxonomy) and the shopper vocabulary from the store's
// profile (Lexicon), so new ones are understood without code changes.
import { COURTESY } from "./dialogue.js"
import { EMPTY_LEXICON, type Lexicon } from "./profile.js"
import { type Taxonomy, categoryNamedIn, fold, near } from "./taxonomy.js"

export type Age = { min: number; max: number }

export type Intent = {
  /** Text left after removing the recognised phrases; what the word index searches for. */
  text: string
  age: Age | null
  /** Category slugs of the age bands that overlap the age asked for. */
  ageSlugs: string[]
  maxPrice: number | null
  cheap: boolean
  offers: boolean
  /** Category the shopper named (most specific match) and its top-level category; boosts, never hard filters. */
  category: string | null
  categoryRoot: string | null
  /** The shopper said the category in words (true) or it was only guessed from the meaning (false). */
  categoryNamed: boolean
  /** The message was nothing but greetings and courtesies. */
  bare: boolean
  /** It says who the purchase is for ("para mi hija") or that it is a gift: a shopper, not small talk. */
  forSomeone: boolean
}

export const MAX_QUERY_LENGTH = 200

/** Spanish connecting words that carry no product meaning. Language, not catalog data. */
const FILLER = /\b(busco|buscando|quiero|necesito|algo|alguna?|un|una|unos|unas|regalo|regalar|para|mi|mis|que|le|les|guste|gusten|con|de|del|el|la|los|las|y|o|por favor|por|en|me|sirva|sirvan|tienen|hay|tienes|tendran|venden|manejan|quisiera|gustaria|estoy|ando|dame|muestrame|muestreme|mostrar|ver|ahora|tambien|cumpleanos|ustedes|recomiend\w*|recomendacion(?:es)?|tiene|tengo|cumple|cumplio|pa|puedo|puede|podria|d[ae]r(?:le|les)?|compr\w*|regal\w*|obsequi\w*|detallitos?|alcanza\w*|sabe[sr]?|cual(?:es)?|es[oa]s|est[oa]s|anteriores|mostraste|mostro|viste|car[oa]s?|costos[oa]s?|catalogo|se|es|son|lo|a|al|si|no|ni)\b/g

/** The words shoppers start a search with. A typo of one of them ("bueco", "nesecito") is still not a product. */
const OPENERS = ["busco", "buscando", "buscar", "quiero", "kiero", "quero", "necesito", "nesecito", "nesesito", "quisiera", "regalo", "regalar", "tienen", "venden", "muestrame", "gracias"]
export const soundsLikeFiller = (word: string) => word.length >= 4 && OPENERS.some((opener) => near(word, opener))

export const ageSlugsFor = (age: Age | null, taxonomy: Taxonomy) =>
  age ? taxonomy.ageBands.filter((band) => age.min <= band.max && age.max >= band.min).map((band) => band.slug) : []

/**
 * "50 mil", "30k", "20 lucas", "120.000", "1 millón" as a number. A bare small number is not money ("tengo 2 hijos"):
 * it needs a unit or at least four digits.
 */
export function amountOf(digits: string, unit: string | undefined): number | null {
  const amount = Number(digits.replace(/[.,]/g, ""))
  if (!Number.isFinite(amount) || amount <= 0) return null
  if (!unit) return amount >= 1000 ? amount : null
  return amount * (unit.startsWith("millon") ? 1_000_000 : 1_000)
}

const UNIT = "(mil|k|lucas?|millon(?:es)?)"
/** How a ceiling is said: "menos de", "hasta", "que no pase de", "tengo", "mi presupuesto es de"… */
const CEILING = "(?:menos de|hasta|maximo|max|por debajo de|no mas de|no pasen? de|tengo|cuento con|presupuesto (?:es )?de)"
const BUDGET = new RegExp(`\\b${CEILING}\\s*\\$?\\s*([\\d.,]+)\\s*${UNIT}?(?:\\s+pesos)?\\b`)
/** "cumple 7", "tiene 4": an age, when the message also says who it is for. */
const AGE_CUE = /\b(?:tiene|tienen|cumple|cumplio|cumplir|cumplira)\s+(\d{1,2})\b/

export function parseIntent(raw: string, taxonomy: Taxonomy, lexicon: Lexicon = EMPTY_LEXICON): Intent {
  let text = fold(raw.slice(0, MAX_QUERY_LENGTH)).replace(/\s+/g, " ").trim()
  const take = (re: RegExp) => { text = text.replace(re, " ").replace(/\s+/g, " ").trim() }

  // "me regalas el número" is Colombian for "give me": only the noun and the infinitive mean a gift
  const forSomeone = (lexicon.audience?.test(text) ?? false) || /\b(regalos?|regalar(?:le|les|selo)?|obsequi\w*|detalles?|detallitos?)\b/.test(text)
  let age: Age | null = null
  const years = /\b(\d{1,2})\s*(?:-|a)?\s*(\d{1,2})?\s*(?:anos?|anitos?)\b/.exec(text)
  const kid = years ? null : lexicon.kidAge?.exec(text)
  if (years) {
    const a = Number(years[1]), b = years[2] ? Number(years[2]) : a
    age = { min: Math.min(a, b), max: Math.max(a, b) }
    take(/\b\d{1,2}\s*(?:-|a)?\s*(?:\d{1,2})?\s*(?:anos?|anitos?)\b/)
  } else if (kid) {
    // "un niño de 8": an age given without the word "años"
    age = { min: Number(kid[1]), max: Number(kid[1]) }
    take(/\bde\s+\d{1,2}\b/)
  } else if (forSomeone && AGE_CUE.test(text)) {
    const n = Number(AGE_CUE.exec(text)![1])
    age = { min: n, max: n }
    take(AGE_CUE)
  } else if (/\b(bebes?|recien nacid\w*|meses)\b/.test(text)) age = { min: 0, max: 2 }
  else if (/\b(preescolar|transicion|jardin)\b/.test(text)) age = { min: 3, max: 5 }

  let maxPrice: number | null = null
  const budget = BUDGET.exec(text)
  const amount = budget ? amountOf(budget[1]!, budget[2]) : null
  if (amount !== null) {
    maxPrice = amount
    take(BUDGET)
  }

  const cheap = /\b([bv]arat\w*|economic\w*|precio bajo)\b/.test(text)
  if (cheap) take(/\b([bv]arat\w*|economic\w*|precio bajo)\b/g)
  const offers = /\b(ofertas?|descuentos?|promocion\w*|rebaj\w*)\b/.test(text)
  if (offers) take(/\b(en )?(ofertas?|descuentos?|promocion\w*|rebaj\w*)\b/g)

  take(COURTESY)
  // prices are already read, so what is left of the punctuation ("hola, …, gracias") is noise
  take(/[^a-z0-9\s]+/g)
  const bare = text === "" && !age && maxPrice === null && !cheap && !offers
  take(FILLER)
  if (lexicon.noise) take(lexicon.noise)
  const named = categoryNamedIn(text, taxonomy)

  return { text, age, ageSlugs: ageSlugsFor(age, taxonomy), maxPrice, cheap, offers, category: named?.slug ?? null, categoryRoot: named?.root ?? null, categoryNamed: named?.whole ?? false, bare, forSomeone }
}

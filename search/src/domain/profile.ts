// Everything that changes from one store to another lives in a profile file (stores/<id>.json): its name, the
// answers to its store questions, who its shoppers buy for and what to ask when a search is too vague.
// The engine never names a store; pointing it at another company is a new profile plus that company's catalog feed.
import { fold } from "./taxonomy.js"

/** What the assistant may ask for when a search is too vague. Each one only applies when the catalog supports it. */
export type SlotId = "age" | "category" | "budget"

export type StoreTopic = { id: string; examples: string[]; replies: string[]; handoff?: boolean }

export type StoreProfile = {
  name: string
  /** For prices in replies, e.g. "es-CO" and "COP". */
  locale: string
  currency: string
  /** What the store sells, in a few words ("juguetes y material didáctico") and as a fuller list for the help reply. */
  offer: string
  catalog: string
  /** Two example searches quoted in the help reply. */
  examples: string[]
  /** Extra first chips on an empty chat, besides the ones built from the live categories. */
  starters: string[]
  /** Questions that close every chat reply and bring the shopper back to the catalog. */
  invitations: string[]
  /** Who the shopper buys for ("niño", "sobrina"): never a product, and "<word> de 8" states an age. */
  audienceWords: string[]
  /** Words that name no particular product ("juguete", "detalle"): alone, they call for a question. */
  genericWords: string[]
  /** What to ask, in order, when the search is vague. `retry` puts the question another way when the reply did not answer it. */
  slots: { id: SlotId; question: string; retry?: string }[]
  /** Budget choices offered when the "budget" slot is asked. */
  budgetSteps: number[]
  /** The store's own questions and answers: shipping, payments, location… */
  topics: StoreTopic[]
}

/** The profile's words compiled for the parser. */
export type Lexicon = {
  /** Audience words and the store's name: taken out of the search text. */
  noise: RegExp | null
  /** Audience words alone: their presence says the shopper is buying for someone. */
  audience: RegExp | null
  /** "<audience word> de <number>". */
  kidAge: RegExp | null
  /** Accent-free words that name no product. */
  generic: Set<string>
}

/** Words that name no product in any store. Language, not catalog data. */
const BASE_GENERIC = ["producto", "productos", "cosa", "cosas", "opcion", "opciones", "articulo", "articulos", "resultados", "mas", "todo", "otros", "otras", "siguientes", "bonito", "bonita", "lindo", "linda", "bueno", "buena", "chevere", "especial", "divertido", "divertida"]

export const EMPTY_LEXICON: Lexicon = { noise: null, audience: null, kidAge: null, generic: new Set(BASE_GENERIC) }

const escape = (word: string) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

export function compileLexicon(profile: Pick<StoreProfile, "name" | "audienceWords" | "genericWords">): Lexicon {
  const audience = profile.audienceWords.map((w) => escape(fold(w.trim()))).filter(Boolean)
  const name = fold(profile.name).split(/[^a-z0-9]+/).filter((w) => w.length >= 3).map(escape)
  const noise = [...audience, ...name]
  return {
    noise: noise.length ? new RegExp(`\\b(?:${noise.join("|")})\\b`, "g") : null,
    audience: audience.length ? new RegExp(`\\b(?:${audience.join("|")})\\b`) : null,
    kidAge: audience.length ? new RegExp(`\\b(?:${audience.join("|")})\\s+de\\s+(\\d{1,2})\\b`) : null,
    generic: new Set([...BASE_GENERIC, ...profile.genericWords.map((w) => fold(w.trim()))]),
  }
}

export const moneyFormat = (profile: Pick<StoreProfile, "locale" | "currency">) => {
  const format = new Intl.NumberFormat(profile.locale, { style: "currency", currency: profile.currency, maximumFractionDigits: 0 })
  return (amount: number) => format.format(amount)
}

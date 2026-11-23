// What makes the search a conversation: each message is read on top of the previous one, and a search that is too
// vague gets a question instead of random products. The server keeps nothing: the browser sends back the Context it
// received with the last answer.
import type { Lexicon, SlotId, StoreProfile } from "./profile.js"
import { type Age, type Intent, ageSlugsFor, amountOf } from "./query.js"
import { type Taxonomy, fold, rootSlugOf, statedBands } from "./taxonomy.js"

export type Context = {
  /** The search as a phrase, for the meaning search. */
  query: string
  /** Its meaningful words, for the word search. */
  text: string
  age: Age | null
  maxPrice: number | null
  cheap: boolean
  offers: boolean
  category: string | null
  /** How many results the shopper has already seen for this search. */
  shown: number
  /** The products on screen (ids of the last results): "los más baratos" and "de esos…" are answered from them. */
  seen: string[]
  /** Questions already asked for this search, and the one waiting for an answer. */
  asked: SlotId[]
  pending: SlotId | null
}

/** One message understood in its conversation. */
export type Turn = {
  intent: Intent
  query: string
  /** Results to skip ("muéstrame más"). */
  offset: number
  asked: SlotId[]
  /** The message built on the previous search instead of starting a new one. */
  followUp: boolean
  /** "shown": answer from the products already on screen; "catalog": search the whole catalog. */
  scope: "shown" | "catalog"
  /** An order asked for in this message ("los más baratos", "el más caro"), and whether only one was asked for. */
  order: "cheap" | "pricey" | null
  one: boolean
}

export const MAX_SEEN = 60
export const WIDEN_OPTION = "en todo el catálogo"

/** What this message asks about the results: an order, a single product, and whether to leave what is on screen. */
export function requestOf(raw: string): { order: "cheap" | "pricey" | null; one: boolean; wide: boolean; refers: boolean } {
  const said = fold(raw).replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim()
  const cheap = /\b([bv]arat\w*|economic\w*|precio bajo|menor (?:precio|valor))\b/.test(said)
  const pricey = /\b(car[oa]s?|costos[oa]s?|mayor (?:precio|valor))\b/.test(said)
  return {
    order: cheap ? "cheap" : pricey ? "pricey" : null,
    one: /\b(?:el|la|cual es)\b(?: \w+){0,2} mas\b/.test(said) && !/\b(?:los|las|cuales)\b/.test(said),
    wide: /\btodo el catalogo\b|\btoda la tienda\b/.test(said),
    refers: /\b(?:de |entre )?(?:es[oa]s|est[oa]s|los anteriores|los que (?:me )?(?:mostraste|diste|salieron))\b/.test(said),
  }
}

export const MAX_QUESTIONS = 2
export const SKIP_OPTION = "Ver de todo"

/** The same said with more words ("no sé, algo bonito"): a skip as long as nothing else is named. */
const SKIP_START = /^(no se|no importa|da igual|me da igual|cualquiera|cualquier cosa|lo que sea|ver de todo|de todo)\b/
const SKIP = /^(ver de todo|de todo|todo|todos|todas|cualquiera|cualquier cosa|no se|no importa|da igual|me da igual|lo que sea|sin preferencia)$/
const MORE = new Set(["mas", "otros", "otras", "siguientes"])
const MORE_PADDING = new Set(["opciones", "productos", "resultados", "parecidos", "similares", "relacionados"])

/** "en Didácticos", "solo en Matemáticas": the same search inside an area, not a new one. */
const WITHIN = /^(?:y\s+)?(?:solo\s+|solamente\s+)?(?:en|dentro de)\s/

const tokens = (text: string) => text.split(" ").filter(Boolean)

/** A text that names no product: empty, or only words like "juguete" or "opciones". */
export const namesNothing = (text: string, lexicon: Lexicon) => tokens(text).every((word) => lexicon.generic.has(word))

/** "más", "otros", "más opciones": the same search, further down the list. */
export const asksForMore = (text: string) => {
  const words = tokens(text)
  return words.some((w) => MORE.has(w)) && words.every((w) => MORE.has(w) || MORE_PADDING.has(w))
}

/** The previous search as an intent. Slugs are checked against today's catalog: the context comes from the browser. */
function intentOf(context: Context, taxonomy: Taxonomy): Intent {
  const category = context.category && taxonomy.bySlug.has(context.category) ? context.category : null
  return {
    text: context.text, age: context.age, ageSlugs: ageSlugsFor(context.age, taxonomy), maxPrice: context.maxPrice, cheap: context.cheap, offers: context.offers,
    category, categoryRoot: category ? rootSlugOf(taxonomy, category) : null, categoryNamed: category !== null, bare: false, forSomeone: false,
  }
}

/**
 * Reads a short reply to the question that was asked: "5" is an age after asking the age, "50 mil" a budget after
 * asking the budget, "ver de todo" skips it. Returns null when the message is not an answer to it.
 */
export function readAnswer(raw: string, now: Intent, pending: SlotId, taxonomy: Taxonomy, lexicon: Lexicon): Intent | null {
  const said = fold(raw).replace(/[^a-z0-9.,$\s]/g, " ").replace(/\s+/g, " ").trim()
  const plain = said.replace(/[.,$]/g, "").trim()
  if (SKIP.test(plain) || (SKIP_START.test(plain) && namesNothing(now.text, lexicon) && !now.category)) return { ...now, text: "" }
  if (pending === "age") {
    if (now.age) return { ...now, text: "" }
    // "5", "tiene 7", "va a cumplir 9": one small number and nothing that names a product
    const numbers = tokens(now.text).filter((word) => /^\d+$/.test(word))
    const number = numbers.length === 1 && namesNothing(tokens(now.text).filter((word) => word !== numbers[0]).join(" "), lexicon) ? /^(\d{1,2})$/.exec(numbers[0]!) : null
    if (!number) return null
    const age = { min: Number(number[1]), max: Number(number[1]) }
    return { ...now, text: "", age, ageSlugs: ageSlugsFor(age, taxonomy) }
  }
  if (pending === "budget") {
    if (now.maxPrice !== null || now.cheap) return { ...now, text: "" }
    const amount = /^\$?\s*([\d.,]+)\s*(mil|k|millon(?:es)?)?(?: pesos)?$/.exec(said)
    const maxPrice = amount ? amountOf(amount[1]!, amount[2]) : null
    return maxPrice === null ? null : { ...now, text: "", maxPrice }
  }
  // a category chosen from the options keeps the search going instead of starting a new one
  return now.category ? { ...now, text: "" } : null
}

/** Reads this message on top of the previous search. */
export function understand(raw: string, parsed: Intent, previous: Context | null, taxonomy: Taxonomy, lexicon: Lexicon): Turn {
  const request = requestOf(raw)
  const fresh: Turn = { intent: parsed, query: raw, offset: 0, asked: [], followUp: false, scope: "catalog", order: request.order, one: false }
  if (!previous) return fresh
  const before = intentOf(previous, taxonomy)
  const stated = Boolean(parsed.age) || parsed.maxPrice !== null || parsed.cheap || parsed.offers || Boolean(parsed.category) || request.order !== null || request.wide

  if (!stated && asksForMore(parsed.text)) return { intent: before, query: previous.query, offset: previous.shown, asked: previous.asked, followUp: true, scope: "catalog", order: before.cheap ? "cheap" : null, one: false }

  const within = parsed.category && WITHIN.test(fold(raw).trim()) ? { ...parsed, text: "" } : null
  const answer = within ?? (previous.pending ? readAnswer(raw, parsed, previous.pending, taxonomy, lexicon) : null)
  const now = answer ?? parsed
  // only conditions, no product of its own ("más baratos", "para 6 años"): same search, adjusted
  if (namesNothing(now.text, lexicon) && (stated || answer)) {
    const age = now.age ?? before.age
    const category = now.category ?? before.category
    return {
      intent: {
        text: before.text, age, ageSlugs: ageSlugsFor(age, taxonomy), maxPrice: now.maxPrice ?? before.maxPrice, cheap: request.order === "pricey" ? false : now.cheap || before.cheap, offers: now.offers || before.offers,
        category, categoryRoot: category ? rootSlugOf(taxonomy, category) : null, categoryNamed: category !== null, bare: false, forSomeone: false,
      },
      query: `${previous.query} ${raw}`.trim().slice(-200),
      offset: 0,
      asked: previous.asked,
      followUp: true,
      // a condition or an order on a search with results on screen is about those results, unless the shopper says otherwise
      scope: previous.seen.length > 0 && previous.pending === null && !request.wide ? "shown" : "catalog",
      order: request.order ?? (before.cheap ? "cheap" : null),
      one: request.one,
    }
  }
  // a new product: a new search. The age stays (it only boosts); budget and offers go, so stale filters never hide results
  if (!namesNothing(now.text, lexicon) && !now.age && before.age) {
    return { ...fresh, intent: { ...now, age: before.age, ageSlugs: ageSlugsFor(before.age, taxonomy) } }
  }
  return fresh
}

/** The search words as the shopper wrote them ("títeres", not the accent-free "titeres" the index uses). */
export function spoken(text: string, source: string): string {
  const written = new Map(source.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean).map((word) => [fold(word), word]))
  return tokens(text).map((word) => written.get(word) ?? word).join(" ")
}

/** The first thing worth asking when the search names no product, or null when it is time to show results. */
export function nextQuestion(turn: Turn, profile: Pick<StoreProfile, "slots" | "budgetSteps">, taxonomy: Taxonomy, lexicon: Lexicon): SlotId | null {
  const { intent, asked } = turn
  if (intent.category || intent.offers || !namesNothing(intent.text, lexicon) || asked.length >= MAX_QUESTIONS) return null
  for (const { id } of profile.slots) {
    if (asked.includes(id)) continue
    if (id === "age" && !intent.age && statedBands(taxonomy).length > 1) return id
    if (id === "category" && areas(taxonomy).length > 1) return id
    if (id === "budget" && intent.maxPrice === null && !intent.cheap && profile.budgetSteps.length > 0) return id
  }
  return null
}

/** Top-level categories that are topics, not the folder that holds the age bands. */
function areas(taxonomy: Taxonomy) {
  const ageRoots = new Set(statedBands(taxonomy).map((band) => rootSlugOf(taxonomy, band.slug)))
  return taxonomy.main.filter((c) => !ageRoots.has(c.slug)).sort((a, b) => b.productCount - a.productCount)
}

/** Answers the shopper can tap. Each one is a message the parser understands, read from today's catalog. */
export function optionsFor(slot: SlotId, profile: Pick<StoreProfile, "budgetSteps">, taxonomy: Taxonomy, money: (amount: number) => string): string[] {
  const options =
    slot === "age" ? statedBands(taxonomy).sort((a, b) => a.min - b.min).flatMap((band) => taxonomy.bySlug.get(band.slug)?.name ?? [])
    : slot === "category" ? areas(taxonomy).slice(0, 6).map((c) => c.name)
    : profile.budgetSteps.map((step) => `Hasta ${money(step)}`)
  return [...options, SKIP_OPTION]
}

export const contextOf = (turn: Turn, shown: number, pending: SlotId | null, seen: string[] = []): Context => ({
  query: turn.query.slice(0, 200), text: turn.intent.text.slice(0, 200), age: turn.intent.age, maxPrice: turn.intent.maxPrice, cheap: turn.intent.cheap, offers: turn.intent.offers,
  category: turn.intent.category, shown, seen: seen.slice(-MAX_SEEN), asked: pending ? [...turn.asked, pending] : turn.asked, pending,
})

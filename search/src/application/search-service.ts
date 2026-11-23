import { type Context, WIDEN_OPTION, asksForMore, contextOf, namesNothing, nextQuestion, optionsFor, readAnswer, requestOf, spoken, understand } from "../domain/conversation.js"
import { composeChat, greets } from "../domain/dialogue.js"
import type { IndexedProduct, ShopProduct } from "../domain/product.js"
import { payablePrice } from "../domain/product.js"
import { type Lexicon, type StoreProfile, compileLexicon, moneyFormat } from "../domain/profile.js"
import { type Intent, parseIntent, soundsLikeFiller } from "../domain/query.js"
import { PRECISE_SHOWN, nameCoverage, precision } from "../domain/relevance.js"
import { composeAgeUnmarked, composeReadAs, composeExact, composeNarrowed, composeNothing, composeOrdered, composeReply, describeIntent } from "../domain/reply.js"
import { starterSuggestions, suggestionsFor } from "../domain/suggestions.js"
import { EMPTY_TAXONOMY, type Taxonomy, ageBandOf, categoryName, contradicts, extraStems, fold, forms, mentions, words } from "../domain/taxonomy.js"
import type { CatalogState } from "./catalog-state.js"
import type { DialogueState } from "./dialogue-state.js"
import type { Embedder, SearchIndex } from "./ports.js"

export type Step = { label: string; ms: number }
/**
 * `kind`: "search" brings products, "chat" is conversation, "ask" is a question back to the shopper (its choices come
 * in `suggestions`). `handoff` asks the page to offer the contact button. `context` goes back with the next message.
 */
/**
 * What the assistant decided to do with a message. Every message ends in exactly one of these:
 *  - "chat": answer a greeting or a store question          - "ask": ask for the detail that is missing
 *  - "search": look in the whole catalog                     - "more": the next results of the same search
 *  - "sort": order the products already on screen by price   - "filter": keep the ones on screen that meet a new condition
 *  - "widen": apply the same request to the whole catalog
 */
export type Action = "chat" | "ask" | "search" | "more" | "sort" | "filter" | "widen"
export type SearchAnswer = { action: Action; kind: "search" | "chat" | "ask"; handoff: boolean; reply: string; intent: Intent; products: ShopProduct[]; suggestions: string[]; context: Context | null; steps: Step[]; indexed: number }

const RESULTS = 12
/** How many to show when the shopper asks for the cheapest or the priciest of what is on screen. */
const ORDERED = 4
const CANDIDATES = 80
/** A candidate must reach this share of the best match's score to be shown. */
const MIN_RELATIVE_SCORE = 0.45

/**
 * Answers a shopper's message in its conversation. A greeting or a store question gets a ready-made reply that invites
 * the next search; a search too vague to be useful gets a question; anything else gets real products: understand it,
 * search by words and meaning, then rank and explain. Nothing is kept between messages: the context travels with them.
 */
export class SearchService {
  private readonly lexicon: Lexicon
  private readonly money: (amount: number) => string

  constructor(private readonly index: SearchIndex, private readonly embedder: Embedder, private readonly catalog: CatalogState, private readonly dialogue: DialogueState, private readonly profile: StoreProfile) {
    this.lexicon = compileLexicon(profile)
    this.money = moneyFormat(profile)
  }

  /** The meaning vector of a phrase. Question and exclamation marks shift it away from the taught phrases; the words carry the question. */
  private meaningOf(text: string): Promise<number[]> {
    return this.embedder.query(text.replace(/[¿?¡!]+/g, " ").replace(/\s+/g, " ").trim() || text)
  }

  /** First chips on an empty chat. */
  starters(): string[] {
    const budget = this.profile.budgetSteps[0]
    return starterSuggestions(this.catalog.taxonomy, this.profile.starters, budget ? this.money(budget) : null)
  }

  /**
   * Keeps numbers, the profile's generic words and what the catalog uses, with typos corrected to the catalog's
   * spelling. The rest is dropped; `unknown` lists the dropped words that looked like a product the store lacks and
   * `fixed` the catalog spelling of the words that were corrected.
   */
  private catalogWords(text: string): { text: string; unknown: string[]; fixed: string[] } {
    const kept: string[] = []
    const unknown: string[] = []
    const fixed: string[] = []
    for (const word of text.split(" ")) {
      if (!word) continue
      if (/^\d+$/.test(word) || this.lexicon.generic.has(word)) { kept.push(word); continue }
      if (word.length < 3) continue
      const known = this.index.knows(word)
      if (known && !(known.typo && soundsLikeFiller(word))) { kept.push(known.word); if (known.typo) fixed.push(known.word) }
      else if (!known && word.length >= 4 && !soundsLikeFiller(word)) unknown.push(word)
    }
    return { text: kept.join(" "), unknown, fixed }
  }

  async answer(query: string, previous: Context | null = null): Promise<SearchAnswer> {
    const steps: Step[] = []
    const time = async <T>(label: string, work: () => Promise<T> | T): Promise<T> => {
      const t0 = performance.now()
      const out = await work()
      steps.push({ label, ms: Math.round(performance.now() - t0) })
      return out
    }

    const taxonomy = this.catalog.taxonomy
    const indexed = this.index.size()
    const parsed = await time("Entendiendo tu búsqueda", () => parseIntent(query, taxonomy, this.lexicon))
    const vector = await time("Analizando el significado", () => this.meaningOf(query))
    const greeted = greets(query)
    const hello = greeted ? "¡Hola! " : ""

    // only words the catalog knows count as naming a product: a typo ("bueco un regalo") or a stray word must lead
    // to a question, not to whatever happens to sit closest to it
    const catalog = this.catalogWords(parsed.text)
    const heard = { ...parsed, text: catalog.text }
    // a stated age, budget or category, an answer to our question or "show me more" is the search going on; otherwise it may be conversation
    const request = requestOf(query)
    // "los más baratos", "de esos…", "en todo el catálogo" with results on screen are about those results
    const aboutShown = previous !== null && previous.seen.length > 0 && (request.order !== null || request.refers || request.wide)
    const continues = aboutShown || (previous !== null && (asksForMore(heard.text) || (previous.pending !== null && readAnswer(query, heard, previous.pending, taxonomy, this.lexicon) !== null)))
    // "ula ula" sounds like a greeting, but the store sells it under that very name
    const keyword = this.index.hasKeyword(fold(query).replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim())
    const searching = continues || keyword || parsed.age || parsed.maxPrice !== null || parsed.forSomeone
    // an area or a word like "descuento" usually means a search, but store questions use them too ("hacen descuento por cantidad")
    const leaning = Boolean(parsed.cheap || parsed.offers || parsed.category)
    const names = new Set([...taxonomy.bySlug.values()].flatMap((c) => words(c.name)))
    const topic = searching ? null : this.dialogue.match(vector, parsed.text, parsed.bare, await this.index.nearest(vector), (word) => forms(word).some((form) => names.has(form)) || this.index.sells(word), leaning)
    if (topic) {
      // talking does not drop the search in progress
      return { action: "chat", kind: "chat", handoff: topic.handoff ?? false, reply: composeChat(topic, query, greeted, this.profile.invitations), intent: parsed, products: [], suggestions: previous ? [] : this.starters(), context: previous, steps, indexed }
    }

    // we asked something and the reply says nothing we can use ("es para mi hijo"): put the question another way, keep what we had
    const stated = continues || parsed.age || parsed.maxPrice !== null || parsed.cheap || parsed.offers || parsed.category
    if (previous?.pending && !stated && namesNothing(heard.text, this.lexicon)) {
      const asked = this.profile.slots.find((s) => s.id === previous.pending)
      if (asked) return { action: "ask", kind: "ask", handoff: false, reply: `${hello}${asked.retry ?? asked.question}`, intent: heard, products: [], suggestions: optionsFor(asked.id, this.profile, taxonomy, this.money), context: previous, steps, indexed }
    }

    const turn = understand(query, heard, previous, taxonomy, this.lexicon)
    const slot = nextQuestion(turn, this.profile, taxonomy, this.lexicon)
    if (slot) {
      // say so when the shopper named something the catalog does not have, instead of asking as if nothing was said
      const missing = !turn.followUp && !parsed.forSomeone && catalog.unknown.length > 0 && catalog.unknown.length <= 2 ? `No encontré «${spoken(catalog.unknown.join(" "), query)}» en el catálogo, pero te ayudo a buscar otra cosa. ` : ""
      const question = `${missing}${this.profile.slots.find((s) => s.id === slot)!.question}`
      return { action: "ask", kind: "ask", handoff: false, reply: `${hello}${question}`, intent: turn.intent, products: [], suggestions: optionsFor(slot, this.profile, taxonomy, this.money), context: contextOf(turn, 0, slot), steps, indexed }
    }

    // what is on screen comes first: an order ("los más baratos") is answered from it alone, a new condition
    // ("para 4 años", "hasta 20 mil") keeps the ones that meet it and only then looks further
    const onScreen = turn.scope === "shown" && previous ? this.index.get(previous.seen) : []
    const kept = onScreen.filter((product) => {
      const price = payablePrice(product)
      if (turn.intent.maxPrice !== null && (price === null || price > turn.intent.maxPrice)) return false
      if (turn.intent.offers && product.salePrice === null) return false
      if (heard.age && !agesOf(product, taxonomy).some((range) => heard.age!.min <= range.max && heard.age!.max >= range.min)) return false
      if (heard.category && !product.categorySlugs.includes(heard.category)) return false
      return true
    })
    if (request.order && previous && onScreen.length) {
      const order = request.order
      const priced = kept.filter((p) => payablePrice(p) !== null).sort((a, b) => (order === "cheap" ? 1 : -1) * (payablePrice(a)! - payablePrice(b)!))
      const chosen = priced.slice(0, turn.one ? 1 : ORDERED)
      if (chosen.length) {
        const wider = `Más ${order === "cheap" ? "económicos" : "caros"} ${WIDEN_OPTION}`
        steps.push({ label: "Ordenando los que ya viste", ms: 0 })
        return { action: "sort", kind: "search", handoff: false, reply: `${hello}${composeOrdered(order, onScreen.length, chosen.length)}`, intent: turn.intent, products: chosen.map(toShop), suggestions: [wider, "Muéstrame más"], context: contextOf(turn, previous.shown, null, previous.seen), steps, indexed }
      }
    }

    const intent = { ...turn.intent }
    const meaning = turn.query === query ? vector : await this.meaningOf(turn.query)
    // no category named in words: use the one closest in meaning, if it clearly stands out
    if (!intent.category) {
      const close = this.catalog.closestCategory(meaning, intent.text)
      if (close) { intent.category = close.slug; intent.categoryRoot = close.root }
    }
    // an area chosen without naming a product is searched by the area's own name
    const text = intent.text || fold(categoryName(taxonomy, turn.intent.category) ?? "")
    const candidates = await time(`Buscando en ${indexed.toLocaleString(this.profile.locale)} productos`, () => this.index.search(text, meaning, CANDIDATES))
    const relevant = await time("Ordenando los resultados", () => rank(candidates, intent, taxonomy))
    // "los más caros en todo el catálogo": among the relevant ones, the most expensive first
    const sorted = turn.order === "pricey" ? relevant.slice(0, 40).filter((p) => payablePrice(p) !== null).sort((a, b) => payablePrice(b)! - payablePrice(a)!) : relevant
    // a new condition: the products on screen that meet it lead, the catalog fills the rest
    const narrowing = onScreen.length > 0 && !request.order
    const keptIds = new Set(kept.map((p) => p.id))
    // when the new condition is an age, what is marked for that age goes before what states no age at all
    const fitsAsked = (p: IndexedProduct) => heard.age !== null && agesOf(p, taxonomy).some((range) => heard.age!.min <= range.max && heard.age!.max >= range.min)
    const others = sorted.filter((p) => !keptIds.has(p.id))
    const filled = narrowing && heard.age ? [...others.filter(fitsAsked), ...others.filter((p) => !fitsAsked(p))] : others
    // asked which of them are for an age, and nothing here or in the catalog is marked for it: show what there is
    // (the ones on screen first) and say plainly that the age is not marked, instead of pretending they were checked
    const ageUnmarked = narrowing && heard.age !== null && kept.length === 0 && !others.some(fitsAsked)
    const stillOnScreen = ageUnmarked ? onScreen.filter((p) => others.some((o) => o.id === p.id)) : []
    const ranked = ageUnmarked ? [...stillOnScreen, ...others.filter((p) => !stillOnScreen.includes(p))] : narrowing ? [...kept, ...filled] : sorted

    // "muéstrame más" skips what the shopper already saw, whatever order the list is in now
    const alreadySeen = new Set(turn.offset > 0 && previous ? previous.seen : [])
    const pending = turn.offset > 0 ? ranked.filter((p) => !alreadySeen.has(p.id)) : ranked
    // the shopper named one product (or a handful): show those first, then a few close ones, not a full page
    const asked = intent.text.split(" ").filter((word) => word.length >= 3 && !this.lexicon.generic.has(word))
    const fresh = turn.offset === 0 && !narrowing && !turn.order
    const named = fresh ? this.index.named(asked) : []
    const namedIds = new Set(named.map((p) => p.id))
    // named ones always count, even when the meaning search did not bring them; the stated conditions (budget,
    // offers, age) still apply
    const matches = rank(named.map((product) => ({ product, score: 1 })), intent, taxonomy)
    // "cuentos infantiles" is the name of a shelf; "dominó de suma en madera" says more than its shelf "Dominós en madera"
    const shelf = intent.categoryNamed && asked.every((word) => words(categoryName(taxonomy, intent.category) ?? "").some((own) => forms(word).includes(own) || forms(own).includes(word)))
    const exact = fresh && precision(asked, named.length, shelf) === "exact" && matches.length > 0
    const top = exact ? [...matches, ...pending.filter((p) => !namedIds.has(p.id))].slice(0, Math.max(PRECISE_SHOWN, matches.length)) : pending.slice(0, RESULTS)
    if (top[0] && asked.length) steps.push({ label: `Coincidencia con el nombre: ${nameCoverage(asked, new Set(fold(top[0].title).split(/[^a-z0-9]+/)), forms)} %`, ms: 0 })
    // a condition nothing meets is not kept: the shopper stays where they were, with what they were seeing
    if (previous && turn.followUp && turn.offset === 0 && top.length === 0) {
      return { action: "filter", kind: "search", handoff: false, reply: `${hello}${composeNothing(describeIntent(turn.intent, taxonomy, this.money), spoken(turn.intent.text, turn.query))}`, intent: turn.intent, products: [], suggestions: previous.seen.length ? ["Muéstrame más"] : [], context: previous, steps, indexed }
    }
    // a follow-up is described by what the shopper said, not by the area guessed from the meaning
    const thread = turn.followUp ? { subject: spoken(turn.intent.text, turn.query), more: turn.offset > 0 } : undefined
    // say how a misspelt product was read, so the shopper sees why these results came up
    const readAs = top.length && catalog.fixed.length ? composeReadAs(catalog.fixed) : ""
    return {
      action: narrowing ? "filter" : request.wide && turn.followUp ? "widen" : turn.offset > 0 ? "more" : "search",
      kind: "search",
      handoff: false,
      reply: `${hello}${readAs}${exact ? composeExact(matches.length, top.length - matches.length) : `${turn.order === "pricey" && !narrowing && top.length ? "Van del más caro al más económico. " : ""}${ageUnmarked && top.length ? composeAgeUnmarked(describeIntent({ ...turn.intent, maxPrice: null, offers: false, cheap: false, category: null }, taxonomy, this.money)) : narrowing && top.length ? composeNarrowed(describeIntent(turn.intent, taxonomy, this.money), kept.length, top.length - Math.min(kept.length, top.length)) : composeReply(query, thread ? turn.intent : intent, taxonomy, top.length, this.money, thread)}`}`,
      intent,
      products: top.map(toShop),
      suggestions: exact ? (pending.length > top.length ? ["Ver más parecidos"] : []) : suggestionsFor(intent, top, taxonomy, pending.length > top.length),
      context: contextOf(turn, turn.offset + top.length, null, [...(turn.offset > 0 && previous ? previous.seen : []), ...top.map((p) => p.id)]),
      steps,
      indexed,
    }
  }
}

/**
 * The ages a product is for. What the store set (on the product or its categories) settles it; otherwise its age
 * categories ("4 a 7 años", "Bebés") and an age range in its own title.
 */
export function agesOf(product: IndexedProduct, taxonomy: Taxonomy): { min: number; max: number }[] {
  if (product.age) return [product.age]
  const bands = new Map(taxonomy.ageBands.map((band) => [band.slug, band]))
  return [...product.categorySlugs.flatMap((slug) => bands.get(slug) ?? []), ...[ageBandOf(product.title)].flatMap((range) => range ?? [])]
}

/**
 * Hard filters for what the shopper stated (budget, offers) and for products made for another age; soft boosts for
 * the age band and catalog area. Products that state no age stay: most of a catalog is not tagged by age.
 */
export function rank(candidates: { product: IndexedProduct; score: number }[], intent: Intent, taxonomy: Taxonomy = EMPTY_TAXONOMY): IndexedProduct[] {
  // categories whose name clashes with the words asked for, e.g. "Motricidad fina" when asking for "motricidad gruesa"
  const clashing = new Map([...taxonomy.bySlug.values()].filter((c) => contradicts(intent.text, c.name)).map((c) => [c.slug, extraStems(intent.text, c.name)]))
  // such a product only drops when its own text never mentions the qualifier asked for
  const clashes = (p: IndexedProduct) => p.categorySlugs.some((slug) => { const wanted = clashing.get(slug); return wanted !== undefined && !mentions(`${p.title} ${p.description}`, wanted) })
  const age = intent.age
  const overlaps = (range: { min: number; max: number }) => age !== null && age.min <= range.max && age.max >= range.min
  const fitsAge = (p: IndexedProduct) => agesOf(p, taxonomy).some(overlaps)
  const affordable = candidates.filter(({ product }) => {
    const price = payablePrice(product)
    if (intent.maxPrice !== null && (price === null || price > intent.maxPrice)) return false
    if (intent.offers && product.salePrice === null) return false
    return true
  })
  // made for another age ("Bebés" when asking for 8 to 11): out, unless nothing else is left
  const rightAge = age ? affordable.filter(({ product }) => { const ages = agesOf(product, taxonomy); return ages.length === 0 || ages.some(overlaps) }) : affordable
  const kept = rightAge.length ? rightAge : affordable
  // relevance first: weak matches are dropped, and the boosts multiply relevance instead of overriding it
  const best = Math.max(0, ...kept.map((c) => c.score))
  const scored = kept.filter(({ score }) => score >= best * MIN_RELATIVE_SCORE).map(({ product, score }) => {
    let factor = 1
    // with no product named, the age is the search: what is made for it goes first
    if (age && fitsAge(product)) factor += intent.text ? 0.3 : 1
    // a category said in words is what the shopper wants ("juegos de encajar"); one guessed from the meaning only nudges
    if (intent.category && product.categorySlugs.includes(intent.category)) factor += intent.categoryNamed ? 0.6 : 0.25
    else if (intent.categoryRoot && product.categorySlugs.includes(intent.categoryRoot)) factor += 0.15
    if (clashing.size && clashes(product)) factor -= 0.4
    if (product.featured) factor += 0.05
    if (!product.inStock) factor -= 0.2
    return { product, s: score * factor }
  })
  scored.sort((a, b) => b.s - a.s)
  if (intent.cheap) {
    // among the relevant ones, cheapest first
    const relevant = scored.slice(0, 40).map((x) => x.product)
    return relevant.sort((a, b) => (payablePrice(a) ?? Infinity) - (payablePrice(b) ?? Infinity))
  }
  return scored.map((x) => x.product)
}

const toShop = ({ id, title, slug, price, salePrice, quoteOnly, inStock, featured, imageId, imageUrl, imageUploaded }: IndexedProduct): ShopProduct =>
  ({ id, title, slug, price, salePrice, quoteOnly, inStock, featured, imageId, imageUrl, imageUploaded })

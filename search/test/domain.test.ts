import { test } from "node:test"
import assert from "node:assert/strict"
import { loadProfile } from "../src/adapters/file-profile.js"
import { OramaIndex } from "../src/adapters/orama-index.js"
import { DialogueState } from "../src/application/dialogue-state.js"
import { type Context, SKIP_OPTION, contextOf, nextQuestion, optionsFor, requestOf, spoken, understand } from "../src/domain/conversation.js"
import { buildTopics, composeChat, greets } from "../src/domain/dialogue.js"
import { type StoreProfile, compileLexicon, moneyFormat } from "../src/domain/profile.js"
import { parseIntent, soundsLikeFiller } from "../src/domain/query.js"
import { composeExact, composeReadAs, composeReply, describeIntent } from "../src/domain/reply.js"
import { nameCoverage, precision } from "../src/domain/relevance.js"
import { starterSuggestions, suggestionsFor } from "../src/domain/suggestions.js"
import { ageBandOf, buildTaxonomy, contradicts, distance, near, soundKey, type Category } from "../src/domain/taxonomy.js"
import { rank } from "../src/application/search-service.js"
import { type IndexedProduct, ageInWords, categoryPaths, passageOf } from "../src/domain/product.js"
import { CatalogState } from "../src/application/catalog-state.js"
import { Indexer } from "../src/application/indexer.js"

// A taxonomy like the store's, plus a category that does not exist today, to prove nothing is hard-coded.
const categories: Category[] = [
  { slug: "ciencias-y-tecnologia", name: "Ciencias y tecnología", parentSlug: null, productCount: 130 },
  { slug: "matematicas", name: "Matemáticas", parentSlug: "ciencias-y-tecnologia", productCount: 55 },
  { slug: "didacticos", name: "Didácticos", parentSlug: null, productCount: 900 },
  { slug: "rompecabezas-en-madera", name: "Rompecabezas en madera", parentSlug: "didacticos", productCount: 40 },
  { slug: "por-edades", name: "Por edades", parentSlug: null, productCount: 230 },
  { slug: "0-a-3-anos", name: "0 a 3 años", parentSlug: "por-edades", productCount: 48 },
  { slug: "4-a-7-anos", name: "4 a 7 años", parentSlug: "por-edades", productCount: 76 },
  { slug: "mas-de-16-anos", name: "Más de 16 años", parentSlug: "por-edades", productCount: 23 },
  { slug: "instrumentos-musicales", name: "Instrumentos musicales", parentSlug: null, productCount: 12 },
  { slug: "uncategorized", name: "Uncategorized", parentSlug: null, productCount: 1 },
]
const taxonomy = buildTaxonomy(categories)
// the real store profile: the tests fail if stores/arisma.json stops being valid
const profile = loadProfile("arisma")
const lexicon = compileLexicon(profile)
const topics = buildTopics(profile)

test("age bands come from category names", () => {
  assert.deepEqual(ageBandOf("4 a 7 años"), { min: 4, max: 7 })
  assert.deepEqual(ageBandOf("Más de 16 años"), { min: 16, max: 99 })
  assert.equal(ageBandOf("Matemáticas"), null)
  assert.deepEqual(taxonomy.ageBands.map((b) => b.slug), ["0-a-3-anos", "4-a-7-anos", "mas-de-16-anos"])
  assert.ok(!taxonomy.main.some((c) => c.slug === "uncategorized"))
})

test("reads age against the live bands and names categories from the live tree", () => {
  const intent = parseIntent("Regalo para un niño de 5 años que le guste la matemática", taxonomy, lexicon)
  assert.deepEqual(intent.age, { min: 5, max: 5 })
  assert.deepEqual(intent.ageSlugs, ["4-a-7-anos"])
  assert.equal(intent.category, "matematicas")
  assert.equal(intent.categoryRoot, "ciencias-y-tecnologia")
  assert.equal(intent.text, "matematica")
})

test("a brand-new category is understood without code changes", () => {
  const intent = parseIntent("instrumentos musicales para preescolar", taxonomy, lexicon)
  assert.equal(intent.category, "instrumentos-musicales")
  assert.deepEqual(intent.age, { min: 3, max: 5 })
  assert.deepEqual(intent.ageSlugs, ["0-a-3-anos", "4-a-7-anos"])
})

test("prefers the most specific category", () => {
  assert.equal(parseIntent("rompecabezas en madera", taxonomy, lexicon).category, "rompecabezas-en-madera")
})

test("reads budgets in mil, k and plain pesos", () => {
  assert.equal(parseIntent("títeres por menos de 50 mil", taxonomy, lexicon).maxPrice, 50_000)
  assert.equal(parseIntent("rompecabezas hasta 30k", taxonomy, lexicon).maxPrice, 30_000)
  assert.equal(parseIntent("algo máximo $120.000", taxonomy, lexicon).maxPrice, 120_000)
  assert.equal(parseIntent("kit por menos de 1 millón", taxonomy, lexicon).maxPrice, 1_000_000)
  assert.equal(parseIntent("títeres por menos de 50 mil", taxonomy, lexicon).text, "titeres")
})

test("reads cheap and offers without keeping those words", () => {
  const intent = parseIntent("rompecabezas baratos en oferta", taxonomy, lexicon)
  assert.equal(intent.cheap, true)
  assert.equal(intent.offers, true)
  assert.equal(intent.text, "rompecabezas")
})

test("replies describe only what was understood, with live names", () => {
  assert.equal(describeIntent(parseIntent("matemáticas por menos de 50 mil", taxonomy, lexicon), taxonomy).replace(/ /g, " "), "en Matemáticas, por menos de $ 50.000")
  assert.match(composeReply("xyz", parseIntent("xyz", taxonomy, lexicon), taxonomy, 0), /No encontré|no di con nada/)
  assert.match(composeReply("ciencia", parseIntent("ciencia", taxonomy, lexicon), taxonomy, 12), /12 más relevantes/)
})

const product = (over: Partial<IndexedProduct>): IndexedProduct => ({
  id: "1", title: "p", slug: "p", price: 10_000, salePrice: null, quoteOnly: false, inStock: true, featured: false,
  imageId: null, imageUrl: null, imageUploaded: false, description: "", categories: [], categorySlugs: [], keywords: [], age: null, ...over,
})

test("suggestions use the categories and age bands found among the results", () => {
  const results = [product({ categorySlugs: ["instrumentos-musicales", "4-a-7-anos"] }), product({ id: "2", categorySlugs: ["instrumentos-musicales"] })]
  const chips = suggestionsFor(parseIntent("tambores", taxonomy, lexicon), results, taxonomy, true)
  assert.deepEqual(chips, ["Más económicos", "Para 4 a 7 años", "Solo en Instrumentos musicales", "Muéstrame más"])
  // every chip is a follow-up the conversation understands as the same search, adjusted
  const base = say("tambores", null)
  for (const chip of chips) {
    const next = say(chip, base.context)
    assert.equal(next.turn.intent.text, "tambores", chip)
    assert.ok(next.turn.followUp, chip)
  }
  assert.ok(starterSuggestions(taxonomy, profile.starters, "50 mil").length >= 3)
})

test("budget and offers are hard filters; age band is a boost; weak matches are dropped", () => {
  const cheap = product({ id: "a", price: 20_000 })
  const pricey = product({ id: "b", price: 90_000 })
  const quote = product({ id: "c", price: null, quoteOnly: true })
  assert.deepEqual(rank([{ product: cheap, score: 0.5 }, { product: pricey, score: 0.9 }, { product: quote, score: 0.9 }], parseIntent("hasta 50 mil", taxonomy, lexicon)).map((p) => p.id), ["a"])
  const young = product({ id: "y", categorySlugs: ["4-a-7-anos"] })
  const other = product({ id: "o" })
  assert.equal(rank([{ product: other, score: 0.6 }, { product: young, score: 0.55 }], parseIntent("juego 5 años", taxonomy, lexicon), taxonomy)[0]!.id, "y")
  const weak = product({ id: "w" })
  assert.deepEqual(rank([{ product: other, score: 1 }, { product: weak, score: 0.2 }], parseIntent("juego", taxonomy, lexicon)).map((p) => p.id), ["o"])
})

test("a category that only shares a word is not taken for the one asked ('gruesa' is not 'fina')", () => {
  const motor = buildTaxonomy([
    { slug: "motricidad-fina", name: "Motricidad fina", parentSlug: null, productCount: 36 },
    { slug: "circuitos-para-motricidad", name: "Circuitos para motricidad", parentSlug: null, productCount: 25 },
  ])
  assert.ok(contradicts("motricidad gruesa", "Motricidad fina"))
  assert.ok(!contradicts("motricidad fina", "Motricidad fina"))
  assert.ok(!contradicts("circuitos motricidad", "Circuitos para motricidad"))
  assert.equal(parseIntent("motricidad gruesa", motor).category, null)
  assert.equal(parseIntent("circuitos de motricidad", motor).category, "circuitos-para-motricidad")
  const fine = product({ id: "f", categorySlugs: ["motricidad-fina"] })
  const circuit = product({ id: "c", categorySlugs: ["circuitos-para-motricidad"] })
  assert.equal(rank([{ product: fine, score: 0.9 }, { product: circuit, score: 0.7 }], parseIntent("motricidad gruesa", motor), motor)[0]!.id, "c")
})

test("courtesies never reach the word search, and an age can come without the word años", () => {
  const intent = parseIntent("Hola, buenas tardes, quisiera ver rompecabezas para mi sobrino de 6, gracias", taxonomy, lexicon)
  assert.equal(intent.text, "rompecabezas")
  assert.deepEqual(intent.age, { min: 6, max: 6 })
  assert.equal(parseIntent("hola cómo estás", taxonomy, lexicon).text, "")
  assert.ok(parseIntent("hola cómo estás", taxonomy, lexicon).bare)
  assert.ok(!parseIntent("un regalo", taxonomy, lexicon).bare)
  assert.ok(greets("¡Hola! busco títeres"))
  assert.ok(!greets("títeres de hola kitty"))
})

test("chat replies answer and then invite a search; a farewell does not push", () => {
  const byId = (id: string) => topics.find((t) => t.id === id)!
  assert.match(composeChat(byId("wellbeing"), "hola como estas", true, profile.invitations), /gracias.*(\?|opciones\.)$/)
  assert.match(composeChat(byId("shipping"), "hola hacen envios", true, profile.invitations), /^¡Hola! Sí, despachamos/)
  assert.doesNotMatch(composeChat(byId("farewell"), "chao", false, profile.invitations), /\?$/)
  for (const topic of topics) assert.ok(topic.examples.length >= 6 && topic.replies.length >= 1, topic.id)
})

test("a message close to a taught example is chat unless it names something the catalog sells", async () => {
  // fake embedder: one axis per word, so "telefono de juguete" is close to the contact topic without being one of its examples
  const axis: [string, number][] = [["hola", 1], ["telefono", 1], ["envio", 1], ["juguete", 0.4]]
  const embed = (text: string) => { const v = axis.map(([w, weight]) => (text.toLowerCase().includes(w) ? weight : 0)); const n = Math.hypot(...v) || 1; return v.map((x) => x / n) }
  const state = new DialogueState(topics)
  await state.load({ query: async (t) => embed(t.normalize("NFD").replace(/[\u0300-\u036f]/g, "")), passages: async () => [] })
  const sells = (word: string) => word === "juguete"
  // far from any product: conversation
  assert.equal(state.match(embed("telefono de contacto"), "telefono contacto", false, 0.82, sells)?.id, "human")
  // a narrow win over the nearest product, and half its words are things the catalog sells: a search
  assert.equal(state.match(embed("telefono de juguete"), "telefono juguete", false, 0.86, sells), null)
  // closer to a product than to any taught phrase: a search, whatever the words
  assert.equal(state.match(embed("telefono de contacto"), "telefono contacto", false, 0.97, sells), null)
  assert.equal(state.match(embed("hola"), "", true, 0.9, sells)?.id, "greeting")
  assert.equal(state.match(embed("microscopio"), "microscopio", false, 0.88, sells), null)
  // "un regalo" leaves no words, but it is not a greeting: it must reach the search and get a question
  assert.equal(state.match(embed("un regalo"), "", false, 0.83, sells), null)
  assert.ok(parseIntent("necesito un regalo urgente", taxonomy, lexicon).forSomeone)
  assert.ok(!parseIntent("me regalas el número de whatsapp", taxonomy, lexicon).forSomeone)
})

// one conversation step: parse, read it on the previous context, and say what would be asked
const say = (message: string, previous: Context | null, store: StoreProfile = profile, tree = taxonomy) => {
  const lex = compileLexicon(store)
  const turn = understand(message, parseIntent(message, tree, lex), previous, tree, lex)
  const slot = nextQuestion(turn, store, tree, lex)
  return { turn, slot, context: contextOf(turn, slot ? 0 : turn.offset + 12, slot, previous?.seen ?? []) }
}

test("a vague search is asked for the age, then the area, and never more than twice", () => {
  const first = say("un regalo", null)
  assert.equal(first.slot, "age")
  assert.deepEqual(optionsFor("age", profile, taxonomy, moneyFormat(profile)), ["0 a 3 años", "4 a 7 años", "Más de 16 años", SKIP_OPTION])
  const second = say("5", first.context)
  assert.deepEqual(second.turn.intent.age, { min: 5, max: 5 })
  assert.equal(second.slot, "category")
  // the folder that holds the age bands is not offered as an area
  assert.ok(!optionsFor("category", profile, taxonomy, moneyFormat(profile)).includes("Por edades"))
  const third = say("Didácticos", second.context)
  assert.equal(third.slot, null)
  assert.equal(third.turn.intent.category, "didacticos")
  assert.deepEqual(third.turn.intent.age, { min: 5, max: 5 })
  // skipping both questions still ends in a search
  const skipped = say(SKIP_OPTION, say("ver de todo", first.context).context)
  assert.equal(skipped.slot, null)
  // a search that names a product is never questioned
  assert.equal(say("rompecabezas", null).slot, null)
  assert.equal(say("juguetes en oferta", null).slot, null)
})

test("follow-ups adjust the same search; a new product starts another one", () => {
  const base = say("rompecabezas", null)
  const cheaper = say("más baratos", base.context)
  assert.equal(cheaper.turn.intent.text, "rompecabezas")
  assert.ok(cheaper.turn.intent.cheap && cheaper.turn.followUp)
  const aged = say("para 6 años y hasta 80 mil", cheaper.context)
  assert.deepEqual([aged.turn.intent.text, aged.turn.intent.age?.min, aged.turn.intent.maxPrice, aged.turn.intent.cheap], ["rompecabezas", 6, 80_000, true])
  const more = say("muéstrame más", aged.context)
  assert.equal(more.turn.offset, 12)
  assert.equal(more.turn.intent.maxPrice, 80_000)
  // new product: keeps the age, drops budget and cheap
  const other = say("y matemáticas?", more.context)
  assert.deepEqual([other.turn.intent.category, other.turn.intent.age?.min, other.turn.intent.maxPrice, other.turn.intent.cheap, other.turn.offset], ["matematicas", 6, null, false, 0])
  // a category slug the catalog no longer has is dropped instead of trusted
  const stale = say("más baratos", { ...base.context, category: "ya-no-existe" })
  assert.equal(stale.turn.intent.category, null)
})

test("another store only needs another profile: a hardware store asks for the budget, never the age", () => {
  const hardware: StoreProfile = {
    ...profile, name: "Ferretería El Tornillo", offer: "herramientas y materiales de obra", catalog: "herramientas, pinturas y eléctricos", examples: ["taladro percutor", "pintura blanca hasta 80 mil"],
    starters: [], audienceWords: [], genericWords: ["casa", "hogar"], slots: [{ id: "budget", question: "¿Cuánto quieres invertir?" }], budgetSteps: [50_000, 150_000], topics: [],
  }
  const tree = buildTaxonomy([
    { slug: "herramientas", name: "Herramientas", parentSlug: null, productCount: 300 },
    { slug: "pinturas", name: "Pinturas", parentSlug: null, productCount: 120 },
  ])
  const first = say("necesito algo para la casa", null, hardware, tree)
  assert.equal(first.slot, "budget")
  assert.deepEqual(optionsFor("budget", hardware, tree, moneyFormat(hardware)).map((o) => o.replace(/\s/g, " ")), ["Hasta $ 50.000", "Hasta $ 150.000", SKIP_OPTION])
  const second = say("150 mil", first.context, hardware, tree)
  assert.equal(second.turn.intent.maxPrice, 150_000)
  assert.equal(second.slot, null)
  // "niño" means nothing to this store, and its greeting names it
  assert.equal(parseIntent("taladro para niño", tree, compileLexicon(hardware)).text, "taladro nino")
  assert.match(buildTopics(hardware)[0]!.replies[0]!, /Ferretería El Tornillo.*herramientas/)
  assert.equal(buildTopics(hardware).some((t) => t.store), false)
})

test("follow-up replies read well with and without a subject", () => {
  const six = parseIntent("para 6 años", taxonomy, lexicon)
  assert.equal(composeReply("x", six, taxonomy, 12, undefined, { subject: "rompecabezas", more: false }), "Listo, sigo con «rompecabezas», para 6 años. Te muestro 12 que encajan.")
  assert.equal(composeReply("x", six, taxonomy, 12, undefined, { subject: "", more: false }), "Listo: para 6 años. Te muestro 12 que encajan.")
  assert.equal(composeReply("x", six, taxonomy, 5, undefined, { subject: "", more: true }), "Aquí van otras 5 opciones para 6 años.")
  assert.match(composeReply("x", six, taxonomy, 0, undefined, { subject: "títeres", more: false }), /^No encontré nada para «títeres», para 6 años\./)
  assert.equal(spoken("titeres dinosaurio", "y Títeres de dinosaurio?"), "títeres dinosaurio")
})

test("a stated age leaves out what is made for another age, and puts what fits first", () => {
  const tree = buildTaxonomy([...categories, { slug: "bebes", name: "Bebés", parentSlug: "didacticos", productCount: 30 }])
  // "Bebés" tells an age without numbers, but it is not offered as an age range nor hidden as an area name
  assert.deepEqual(tree.ageBands.find((b) => b.slug === "bebes"), { slug: "bebes", min: 0, max: 2, implied: true })
  assert.ok(!optionsFor("age", profile, tree, moneyFormat(profile)).includes("Bebés"))
  const eight = parseIntent("para 8 años", tree, lexicon)
  const baby = product({ id: "baby", title: "Silla mecedora", categorySlugs: ["bebes", "didacticos"] })
  const little = product({ id: "little", title: "Cartilla Edad 5 a 6 Años" })
  const untagged = product({ id: "untagged", title: "Pista de carreras" })
  const fits = product({ id: "fits", title: "Kit de ciencia", categorySlugs: ["mas-de-16-anos"] })
  const teen = parseIntent("para 16 años", tree, lexicon)
  assert.deepEqual(rank([{ product: baby, score: 1 }, { product: little, score: 0.9 }, { product: untagged, score: 0.8 }], eight, tree).map((p) => p.id), ["untagged"])
  assert.deepEqual(rank([{ product: untagged, score: 1 }, { product: fits, score: 0.6 }, { product: baby, score: 0.9 }], teen, tree).map((p) => p.id), ["fits", "untagged"])
  // nothing else left: better the wrong age than an empty answer
  assert.deepEqual(rank([{ product: baby, score: 1 }], eight, tree).map((p) => p.id), ["baby"])
})

test("typos are recognised as typos, not as products", async () => {
  assert.ok(near("rompecabesas", "rompecabezas") && near("titere", "titeres") && near("ajerdez", "ajedrez"))
  assert.ok(!near("bus", "busco") && !near("regalo", "regalos de") && !near("mesa", "masas"))
  assert.ok(soundsLikeFiller("bueco") && soundsLikeFiller("nesecito") && soundsLikeFiller("necesto") && !soundsLikeFiller("bus") && !soundsLikeFiller("rompecabezas"))
  const index = new OramaIndex()
  await index.upsert([{ product: product({ id: "r", title: "Rompecabezas de madera", description: "Buen regalo para aprender jugando", categories: ["Didácticos"] }), embedding: new Array(384).fill(0) }])
  assert.deepEqual(index.knows("rompecabezas"), { word: "rompecabezas", typo: false })
  assert.deepEqual(index.knows("didactico"), { word: "didactico", typo: false })
  // one typo, and two in a long word, are corrected to the catalog's spelling
  assert.deepEqual(index.knows("rompecabesas"), { word: "rompecabezas", typo: true })
  assert.deepEqual(index.knows("ronpecabesas"), { word: "rompecabezas", typo: true })
  assert.deepEqual(index.knows("aprender"), { word: "aprender", typo: false })
  assert.equal(index.knows("bueco"), null)
  assert.equal(index.knows("us"), null)
  assert.equal(distance("ronpecabesas", "rompecabezas", 2), 2)
  assert.equal(distance("xbox", "rompecabezas", 2), 3)
  // two swapped letters are one slip
  assert.equal(distance("lotreia", "loteria", 1), 1)
  // spelt by ear: same sound, catalog spelling, even in short words
  assert.equal(soundKey("girafa"), soundKey("jirafa"))
  assert.equal(soundKey("yaves"), soundKey("llaves"))
  assert.equal(soundKey("cavallo"), soundKey("caballo"))
  assert.equal(soundKey("vloques"), soundKey("bloques"))
  assert.equal(soundKey("ronpecabesas"), "ronpekabesas")
  assert.notEqual(soundKey("guerra"), soundKey("jerra"))
  assert.notEqual(soundKey("chupo"), soundKey("kupo"))
  await index.upsert([{ product: product({ id: "j", title: "Jirafa de peluche con llaves", categories: ["Peluches"] }), embedding: new Array(384).fill(0) }])
  assert.deepEqual(index.knows("girafa"), { word: "jirafa", typo: true })
  assert.deepEqual(index.knows("yaves"), { word: "llaves", typo: true })
  assert.equal(composeReadAs(["jirafa", "jirafa"]), "Lo busqué como «jirafa». ")

  // answers to "how old?" said in a sentence, and a skip said with more words
  const asked = say("un regalo", null).context
  assert.deepEqual(say("tiene 7", asked).turn.intent.age, { min: 7, max: 7 })
  assert.equal(say("tiene 7", asked).slot, "category")
  assert.equal(say("no sé, algo bonito", say("tiene 7", asked).context).slot, null)
  assert.ok(parseIntent("rompecabezas mas varatos", taxonomy, lexicon).cheap)
})

test("requests about what is on screen: an order, a single one, 'de esos', and leaving the screen", () => {
  assert.deepEqual(requestOf("los más baratos"), { order: "cheap", one: false, wide: false, refers: false })
  assert.deepEqual(requestOf("¿cuál es el más caro?"), { order: "pricey", one: true, wide: false, refers: false })
  assert.deepEqual(requestOf("de esos el mas economico"), { order: "cheap", one: true, wide: false, refers: true })
  assert.deepEqual(requestOf("Más económicos en todo el catálogo"), { order: "cheap", one: false, wide: true, refers: false })
  assert.equal(requestOf("carros de juguete").order, null)

  const seen = ["11111111-1111-4111-8111-111111111111"]
  const shown = { ...say("rompecabezas", null).context, seen }
  // with results on screen, an order or a condition is about them
  assert.deepEqual([say("los más baratos", shown).turn.scope, say("los más baratos", shown).turn.order], ["shown", "cheap"])
  assert.equal(say("de esos cuales son para 4 años", shown).turn.scope, "shown")
  assert.equal(say("de esos cuales son para 4 años", shown).turn.intent.text, "rompecabezas")
  // unless the shopper asks for the whole catalog, asks for more, or names another product
  assert.equal(say("más económicos en todo el catálogo", shown).turn.scope, "catalog")
  assert.equal(say("muéstrame más", shown).turn.scope, "catalog")
  assert.equal(say("títeres", shown).turn.scope, "catalog")
  // nothing on screen yet: there is nothing to order
  assert.equal(say("los más baratos", say("rompecabezas", null).context).turn.scope, "catalog")
  // "el más caro" drops a previous "más baratos"
  assert.equal(say("cual es el mas caro", say("los más baratos", shown).context).turn.intent.cheap, false)
})

test("the store's keywords and ages: a category is named by a keyword, and a product's own age settles it", async () => {
  const tree = buildTaxonomy([
    ...categories,
    { slug: "rompecabezas", name: "Rompecabezas", parentSlug: "didacticos", productCount: 80, keywords: ["puzzle", "armar piezas"] },
    { slug: "primera-infancia", name: "Primera infancia", parentSlug: "didacticos", productCount: 30, age: { min: 0, max: 2 } },
  ])
  assert.equal(parseIntent("tienen puzzles", tree, lexicon).category, "rompecabezas")
  assert.equal(parseIntent("algo para armar piezas", tree, lexicon).category, "rompecabezas")
  // one word of a two-word keyword is not enough
  assert.equal(parseIntent("piezas de ajedrez", tree, lexicon).category, null)
  // the age the store set on a category works like "Bebés": it filters, but is not offered as an age range
  assert.deepEqual(tree.ageBands.find((b) => b.slug === "primera-infancia"), { slug: "primera-infancia", min: 0, max: 2, implied: true })

  const eight = parseIntent("para 8 años", tree, lexicon)
  const tagged = product({ id: "tagged", title: "Kit de química", age: { min: 8, max: 12 } })
  // its own age wins over the category it sits in and over a range in its title
  const override = product({ id: "override", title: "Cartilla Edad 3 a 4 Años", categorySlugs: ["primera-infancia"], age: { min: 7, max: 9 } })
  const infant = product({ id: "infant", title: "Móvil musical", categorySlugs: ["primera-infancia"] })
  const plain = product({ id: "plain", title: "Pista de carreras" })
  assert.deepEqual(rank([{ product: plain, score: 1 }, { product: infant, score: 0.9 }, { product: tagged, score: 0.6 }, { product: override, score: 0.55 }], eight, tree).map((p) => p.id), ["tagged", "override", "plain"])

  const index = new OramaIndex()
  await index.upsert([{ product: product({ id: "k", title: "Rompecabezas de madera", keywords: ["puzzle", "lego"] }), embedding: new Array(384).fill(0) }])
  assert.deepEqual(index.knows("puzzles"), { word: "puzzles", typo: false })
  assert.ok(index.sells("lego") && !index.sells("xbox"))
  assert.equal((await index.search("puzzle", new Array(384).fill(0), 5))[0]?.product.id, "k")
})

test("the meaning model reads the title twice, then categories and keywords, then the description", () => {
  const passage = passageOf(product({ title: "Rompecabezas Circo", description: "Elaborado en madera.", categories: ["Didácticos", "Rompecabezas"], keywords: ["puzzle", "armatodo"] }))
  assert.equal(passage, "passage: Rompecabezas Circo. Rompecabezas Circo. Didácticos, Rompecabezas, puzzle, armatodo. Elaborado en madera.")
  assert.ok(passageOf(product({ title: "Largo", description: "palabra ".repeat(1000) })).length <= 1200)
  // the helpers the variants use: deepest category paths without age ranges, and the age in words
  const tree = buildTaxonomy([...categories, { slug: "rompecabezas", name: "Rompecabezas", parentSlug: "didacticos", productCount: 80 }])
  assert.deepEqual(categoryPaths(["didacticos", "rompecabezas", "4-a-7-anos"], tree), [["Didácticos", "Rompecabezas"]])
  assert.equal(ageInWords({ min: 16, max: 99 }), "desde 16 años")
})

test("a full rebuild is prepared aside and swapped in; the old index answers meanwhile", async () => {
  const live = new OramaIndex()
  const zero = new Array(384).fill(0)
  await live.upsert([{ product: product({ id: "old", title: "Viejo" }), embedding: zero }])
  let seenDuringBuild = -1
  const feed = {
    categories: async () => [],
    changes: async () => { seenDuringBuild = live.size(); return { products: [{ ...product({ id: "new", title: "Nuevo" }), updatedAt: "2026-01-01T00:00:00Z" }], removed: [] } },
  }
  const embedder = { query: async () => zero, passages: async (texts: string[]) => texts.map(() => zero) }
  const saved: unknown[] = []
  const indexer = new Indexer(feed, embedder, live, new CatalogState(), { read: async () => null, write: async (s) => { saved.push(s) } }, { model: "m", index: "i" }, () => new OramaIndex(), () => {})
  await indexer.sync(true)
  assert.equal(seenDuringBuild, 1)
  // the product that left the catalog is gone, the new one is in
  assert.deepEqual(live.get(["old", "new"]).map((p) => p.id), ["new"])
  assert.equal((saved[0] as { indexKey: string }).indexKey, "i")
  // an empty catalog answer does not wipe it
  const empty = new Indexer({ ...feed, changes: async () => ({ products: [], removed: [] }) }, embedder, live, new CatalogState(), { read: async () => null, write: async () => {} }, { model: "m", index: "i" }, () => new OramaIndex(), () => {})
  await empty.sync(true)
  assert.equal(live.size(), 1)
})

test("a precise name shows a few results; a general ask keeps the full page", () => {
  assert.equal(precision(["tablero", "verde", "arco"], 1, false), "exact")
  assert.equal(precision(["rompecabezas", "madera"], 458, false), "broad")
  // one word is a kind of product, a category name is a shelf, and no name at all is not a match
  assert.equal(precision(["xilofono"], 1, false), "broad")
  assert.equal(precision(["cuentos", "infantiles"], 1, true), "broad")
  assert.equal(precision(["tablero", "rojo"], 0, false), "broad")
  assert.equal(nameCoverage(["tablero", "verde", "arco"], new Set(["tablero", "verde", "mini", "arco"]), (w) => [w]), 100)
  assert.equal(nameCoverage(["tablero", "rojo"], new Set(["tablero", "verde"]), (w) => [w]), 50)
  assert.equal(composeExact(1, 3), "Este es el que buscas. Te dejo también 3 parecidos; si quieres ver más, pídemelos.")
  // "Ver más parecidos" is "show me more" of the same search
  assert.equal(say("Ver más parecidos", say("tablero verde mini arco", null).context).turn.offset, 12)
})

test("among categories the question names equally, the one with fewer unsaid words wins", () => {
  const tree = buildTaxonomy([
    { slug: "rompecabezas-en-madera", name: "Rompecabezas en madera", parentSlug: "didacticos", productCount: 477 },
    { slug: "rompecabezas-de-colombia", name: "Rompecabezas de Colombia en madera", parentSlug: "rompecabezas-en-madera", productCount: 2 },
    { slug: "juegos", name: "Juegos", parentSlug: null, productCount: 583 },
    { slug: "para-encajar", name: "Para encajar", parentSlug: "juegos", productCount: 24 },
    { slug: "didacticos", name: "Didácticos", parentSlug: null, productCount: 900 },
  ])
  assert.equal(parseIntent("rompecabezas de madera", tree, lexicon).category, "rompecabezas-en-madera")
  assert.equal(parseIntent("rompecabezas de colombia", tree, lexicon).category, "rompecabezas-de-colombia")
  assert.equal(parseIntent("juegos de encajar", tree, lexicon).category, "para-encajar")
})

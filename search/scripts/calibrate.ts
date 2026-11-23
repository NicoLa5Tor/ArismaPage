// Prints, for every search in the phrase bank, the numbers the "how many to show" rule can use: how close in meaning
// the first and second products are (cosine), the hybrid score gap, and how many titles carry every word asked for.
// Used to choose the cuts in application/relevance.ts; run it again if the model or the passage text changes.
//   tsx scripts/calibrate.ts [indice.json]
import { readFileSync } from "node:fs"
import { E5Embedder } from "../src/adapters/e5-embedder.js"
import { HttpCatalogFeed } from "../src/adapters/http-catalog-feed.js"
import { OramaIndex } from "../src/adapters/orama-index.js"
import { loadProfile } from "../src/adapters/file-profile.js"
import { rank } from "../src/application/search-service.js"
import { compileLexicon } from "../src/domain/profile.js"
import { parseIntent } from "../src/domain/query.js"
import { buildTaxonomy, fold, forms } from "../src/domain/taxonomy.js"
import { exact, final, fresh, phrases, words } from "./phrases.js"

const file = process.argv[2] ?? new URL("../data/index.json", import.meta.url)
const index = new OramaIndex()
index.restore(JSON.parse(readFileSync(file, "utf8")).index)
const embedder = await E5Embedder.load()
const taxonomy = buildTaxonomy(await new HttpCatalogFeed(process.env.CATALOG_URL ?? "http://127.0.0.1:9001").categories())
const lexicon = compileLexicon(loadProfile(process.env.STORE_PROFILE ?? "arisma"))
const all = index.get([...JSON.parse(readFileSync(file, "utf8")).index.products.map((p: { id: string }) => p.id)])
const titleWords = all.map((p) => new Set(fold(p.title).split(/[^a-z0-9]+/)))
const dot = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i]!, 0)

console.log("tipo    cos1  cos2  gap   h1/h2  cubren  ok  frase")
for (const phrase of [...exact, ...phrases, ...fresh, ...final, ...words].filter((p) => p.expect === "search" && p.title)) {
  const intent = parseIntent(phrase.say, taxonomy, lexicon)
  const vector = await embedder.query(phrase.say)
  const ranked = rank(await index.search(intent.text, vector, 80), intent, taxonomy)
  const hybrid = await index.search(intent.text, vector, 2)
  const meaning = await index.search("", vector, 2)
  const asked = intent.text.split(" ").filter((w) => w.length >= 3)
  const covering = asked.length ? titleWords.filter((t) => asked.every((w) => forms(w).some((f) => t.has(f)))).length : 0
  const [c1, c2] = meaning.map((m) => m.score)
  const ok = ranked[0] && phrase.title!.test(ranked[0].title) ? "sí" : "no"
  console.log(`${phrase.fewer ? "exacta" : "tipo  "}  ${(c1 ?? 0).toFixed(3)} ${(c2 ?? 0).toFixed(3)} ${((c1 ?? 0) - (c2 ?? 0)).toFixed(3)} ${((hybrid[0]?.score ?? 0) / (hybrid[1]?.score || 1)).toFixed(2)}  ${String(covering).padStart(5)}   ${ok.padEnd(2)}  «${phrase.say}» [${intent.text}]`)
}
void dot

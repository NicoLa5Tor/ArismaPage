// Compares how well two saved indexes rank products for the phrase bank: share of the first 12 results that are what
// was asked for, and the position of the first right one (MRR). Also with meaning only, to see the embeddings alone.
//   tsx scripts/compare-index.ts <indice-a.json> <indice-b.json>
import { readFileSync } from "node:fs"
import { E5Embedder } from "../src/adapters/e5-embedder.js"
import { OramaIndex } from "../src/adapters/orama-index.js"
import { loadProfile } from "../src/adapters/file-profile.js"
import { HttpCatalogFeed } from "../src/adapters/http-catalog-feed.js"
import { rank } from "../src/application/search-service.js"
import { compileLexicon } from "../src/domain/profile.js"
import { parseIntent } from "../src/domain/query.js"
import { buildTaxonomy } from "../src/domain/taxonomy.js"
import { final, fresh, phrases, words, type Phrase } from "./phrases.js"

const [fileA, fileB] = process.argv.slice(2)
if (!fileA || !fileB) { console.error("Uso: tsx scripts/compare-index.ts <a.json> <b.json>"); process.exit(1) }
const load = (file: string) => { const index = new OramaIndex(); index.restore(JSON.parse(readFileSync(file, "utf8")).index); return index }
const indexes = { a: load(fileA), b: load(fileB) }
const embedder = await E5Embedder.load()
const taxonomy = buildTaxonomy(await new HttpCatalogFeed(process.env.CATALOG_URL ?? "http://127.0.0.1:9001").categories())
const lexicon = compileLexicon(loadProfile(process.env.STORE_PROFILE ?? "arisma"))
const bank = [...phrases, ...fresh, ...final, ...words].filter((p): p is Phrase & { title: RegExp } => p.expect === "search" && p.title !== undefined)

type Score = { precision: number; reciprocal: number }
const measure = (titles: string[], wanted: RegExp): Score => {
  const top = titles.slice(0, 12)
  const first = top.findIndex((t) => wanted.test(t))
  return { precision: top.length ? top.filter((t) => wanted.test(t)).length / top.length : 0, reciprocal: first < 0 ? 0 : 1 / (first + 1) }
}
const totals = { hybrid: { a: [] as Score[], b: [] as Score[] }, meaning: { a: [] as Score[], b: [] as Score[] } }
const worse: string[] = []
for (const phrase of bank) {
  const intent = parseIntent(phrase.say, taxonomy, lexicon)
  const vector = await embedder.query(phrase.say)
  const row: Record<string, Score> = {}
  for (const key of ["a", "b"] as const) {
    const hybrid = rank(await indexes[key].search(intent.text, vector, 80), intent, taxonomy).map((p) => p.title)
    const meaning = (await indexes[key].search("", vector, 12)).map((c) => c.product.title)
    totals.hybrid[key].push(row[`h${key}`] = measure(hybrid, phrase.title))
    totals.meaning[key].push(row[`m${key}`] = measure(meaning, phrase.title))
  }
  if (row.hb!.precision < row.ha!.precision - 0.2) worse.push(`«${phrase.say}»: ${Math.round(row.ha!.precision * 100)} % → ${Math.round(row.hb!.precision * 100)} %`)
}
const mean = (list: Score[], key: keyof Score) => (list.reduce((s, x) => s + x[key], 0) / list.length * 100).toFixed(1)
console.log(`${bank.length} búsquedas con producto esperado\n`)
for (const mode of ["hybrid", "meaning"] as const) {
  console.log(`${mode === "hybrid" ? "Búsqueda completa" : "Solo significado"}:`)
  for (const key of ["a", "b"] as const) console.log(`  ${key === "a" ? "A" : "B"}  acierto en los 12: ${mean(totals[mode][key], "precision")} %   primer acierto (MRR): ${mean(totals[mode][key], "reciprocal")} %`)
}
if (worse.length) console.log(`\nEmpeoran en B:\n  ${worse.join("\n  ")}`)

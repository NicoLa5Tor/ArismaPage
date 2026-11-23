// Builds a saved index with another way of writing the product passage, to compare it with compare-index.ts before
// changing what the service uses. Does not touch the running service or data/index.json.
//   tsx scripts/build-variant.ts <variante> <salida.json>
import { writeFileSync } from "node:fs"
import { E5Embedder } from "../src/adapters/e5-embedder.js"
import { HttpCatalogFeed } from "../src/adapters/http-catalog-feed.js"
import { OramaIndex } from "../src/adapters/orama-index.js"
import { type IndexedProduct, ageInWords, ageOfProduct, categoryPaths, passageOf } from "../src/domain/product.js"
import { type Taxonomy, buildTaxonomy } from "../src/domain/taxonomy.js"

const variants: Record<string, (p: IndexedProduct, t: Taxonomy) => string> = {
  current: passageOf,
  /** Labelled lines, one per kind of fact (measured worse: MRR 87,1 % against 90,7 % with meaning only). */
  labelled: (p, t) => {
    const paths = categoryPaths(p.categorySlugs, t).map((path) => path.join(" > "))
    const age = ageOfProduct(p, t)
    return [`passage: ${p.title}.`, `Categoría: ${(paths.length ? paths : p.categories).join("; ")}.`, p.keywords.length ? `También se busca como: ${p.keywords.join(", ")}.` : "",
      age ? `Edad: ${ageInWords(age)}.` : "", `Descripción: ${p.description.replace(/\s+/g, " ").trim()}`].filter(Boolean).join("\n").slice(0, 1600)
  },
  /** Plain sentence like the original, plus the category path and the age; no labels. */
  plain: (p, t) => {
    const paths = categoryPaths(p.categorySlugs, t).map((path) => path.join(" > "))
    const age = ageOfProduct(p, t)
    return `passage: ${p.title}. ${p.title}. ${[...(paths.length ? paths : p.categories), ...p.keywords].join(", ")}.${age ? ` Para ${ageInWords(age)}.` : ""} ${p.description.replace(/\s+/g, " ").trim()}`.slice(0, 1600)
  },
}
const [name, out] = process.argv.slice(2)
const passage = name ? variants[name] : undefined
if (!passage || !out) { console.error(`Uso: tsx scripts/build-variant.ts <${Object.keys(variants).join("|")}> <salida.json>`); process.exit(1) }

const feed = new HttpCatalogFeed(process.env.CATALOG_URL ?? "http://127.0.0.1:9001")
const taxonomy = buildTaxonomy(await feed.categories())
const { products } = await feed.changes(null)
const embedder = await E5Embedder.load()
const index = new OramaIndex()
const t0 = performance.now()
for (let i = 0; i < products.length; i += 16) {
  const batch = products.slice(i, i + 16)
  const vectors = await embedder.passages(batch.map((p) => passage(p, taxonomy)))
  await index.upsert(batch.map((product, k) => ({ product, embedding: vectors[k]! })))
}
writeFileSync(out, JSON.stringify({ cursor: new Date().toISOString(), modelKey: "variant", indexKey: name, index: index.snapshot() }))
console.log(`${name}: ${products.length} productos en ${((performance.now() - t0) / 1000).toFixed(0)} s → ${out}`)

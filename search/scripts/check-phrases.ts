// Mide la comprensión del asistente con el banco de frases, contra el servicio en marcha.
//   pnpm phrases            → resumen y las frases que fallan
//   pnpm phrases --all      → además, cómo respondió a cada frase
//   pnpm phrases --fresh    → la segunda tanda
//   pnpm phrases --final    → la tercera, medida una sola vez sin ajustar después
//   pnpm phrases --words    → palabras que solo se entienden con las palabras clave de la tienda
//   pnpm phrases --exact    → nombres precisos de un producto: deben salir pocos
//   pnpm phrases --typos    → errores de ortografía sobre palabras del catálogo
import { exact, final, fresh, phrases as tuned, typos, words } from "./phrases.js"

const url = `${process.env.SEARCH_URL ?? "http://127.0.0.1:9002"}/search`
const all = process.argv.includes("--all")
// --fresh: la tanda que no se usó para afinar
const phrases = process.argv.includes("--typos") ? typos : process.argv.includes("--exact") ? exact : process.argv.includes("--words") ? words : process.argv.includes("--final") ? final : process.argv.includes("--fresh") ? fresh : tuned
type Answer = { kind: string; reply: string; products: { title: string }[]; context: { age: { min: number; max: number } | null; maxPrice: number | null; cheap: boolean } | null; intent: { age: { min: number; max: number } | null; maxPrice: number | null; cheap: boolean } }

const failures: string[] = []
const byKind = new Map<string, { ok: number; total: number }>()
for (const phrase of phrases) {
  const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ q: phrase.say }) })
  const answer = await response.json() as Answer
  const understood = answer.context ?? answer.intent
  const problems: string[] = []
  if (!response.ok) problems.push(`HTTP ${response.status}`)
  else {
    if (answer.kind !== phrase.expect) problems.push(`respondió «${answer.kind}», debía «${phrase.expect}»`)
    if (phrase.topic && !phrase.topic.test(answer.reply)) problems.push(`la respuesta no habla de ${phrase.topic}`)
    if (phrase.title && answer.kind === "search" && !answer.products.some((p) => phrase.title!.test(p.title))) problems.push(`ningún resultado con ${phrase.title}: ${answer.products.slice(0, 3).map((p) => p.title.slice(0, 28)).join(" · ") || "sin resultados"}`)
    if (phrase.age !== undefined && !(understood.age && understood.age.min <= phrase.age && understood.age.max >= phrase.age)) problems.push(`no entendió la edad ${phrase.age}`)
    if (phrase.max !== undefined && understood.maxPrice !== phrase.max) problems.push(`presupuesto ${understood.maxPrice}, debía ${phrase.max}`)
    if (phrase.cheap && !understood.cheap) problems.push("no entendió que quería lo más barato")
    if (phrase.fewer && answer.products.length > 4) problems.push(`mostró ${answer.products.length}; con un nombre tan preciso bastaban 4 o menos`)
    if (phrase.fewer === undefined && phrase.expect === "search" && phrase.title && answer.products.length < 5 && process.argv.includes("--exact")) problems.push(`solo mostró ${answer.products.length}; es un tipo de producto, no uno en particular`)
  }
  const group = byKind.get(phrase.expect) ?? { ok: 0, total: 0 }
  group.total++
  if (!problems.length) group.ok++
  byKind.set(phrase.expect, group)
  if (problems.length) failures.push(`✖ «${phrase.say}»: ${problems.join("; ")}`)
  if (all) console.log(`${problems.length ? "✖" : "✔"} «${phrase.say}» → [${answer.kind}] ${answer.reply?.slice(0, 80)}`)
}

const ok = phrases.length - failures.length
console.log(`\nEntiende ${ok} de ${phrases.length} frases (${Math.round((ok / phrases.length) * 100)} %)`)
for (const [kind, { ok, total }] of byKind) console.log(`  ${kind.padEnd(7)} ${ok}/${total}`)
if (failures.length) console.log(`\n${failures.join("\n")}`)
process.exit(failures.length ? 1 : 0)

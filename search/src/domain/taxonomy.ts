// The store's category tree, read from the catalog at every sync. Nothing here is hard-coded: new categories,
// renamed ones and new age bands ("2 a 4 años") are understood as soon as they are published.

/** `keywords` are other words shoppers use for it and `age` who it is for; the store sets both, and both are optional. */
export type Category = { slug: string; name: string; parentSlug: string | null; productCount: number; keywords?: string[]; age?: { min: number; max: number } | null }
/** `implied` marks a category that tells an age by its name alone ("Bebés") instead of stating a range ("0 a 3 años"). */
export type AgeBand = { slug: string; min: number; max: number; implied?: boolean }

export type Taxonomy = {
  bySlug: Map<string, Category>
  /** Top-level categories that hold products. */
  main: Category[]
  /** Age ranges parsed from category names such as "4 a 7 años" or "Más de 16 años". */
  ageBands: AgeBand[]
}

export const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")

export function ageBandOf(name: string): { min: number; max: number } | null {
  const text = fold(name)
  const range = /(\d{1,2})\s*(?:a|-|al?)\s*(\d{1,2})\s*anos?/.exec(text)
  if (range) return { min: Number(range[1]), max: Number(range[2]) }
  const over = /(?:mas de|mayores de|desde)\s*(\d{1,2})\s*anos?/.exec(text)
  if (over) return { min: Number(over[1]), max: 99 }
  const upTo = /(?:hasta|menores de)\s*(\d{1,2})\s*anos?/.exec(text)
  if (upTo) return { min: 0, max: Number(upTo[1]) }
  return null
}

/** An age told without numbers. The same words the question parser understands. Language, not catalog data. */
export function impliedAgeOf(name: string): { min: number; max: number } | null {
  const text = fold(name)
  if (/\b(bebes?|recien nacid\w*)\b/.test(text)) return { min: 0, max: 2 }
  if (/\bpreescolar\b/.test(text)) return { min: 3, max: 5 }
  return null
}

/** The ranges the store states as such ("4 a 7 años"): the ones offered as choices. */
export const statedBands = (taxonomy: Taxonomy) => taxonomy.ageBands.filter((band) => !band.implied)

export function buildTaxonomy(categories: Category[]): Taxonomy {
  const visible = categories.filter((c) => c.slug !== "uncategorized")
  const bySlug = new Map(visible.map((c) => [c.slug, c]))
  const main = visible.filter((c) => !c.parentSlug && c.productCount > 0)
  const ageBands = visible.flatMap((c) => {
    if (c.productCount === 0) return []
    const band = ageBandOf(c.name)
    if (band) return [{ slug: c.slug, ...band }]
    // the age the store set on the category counts before anything guessed from its name
    const implied = c.age ?? impliedAgeOf(c.name)
    return implied ? [{ slug: c.slug, ...implied, implied: true }] : []
  })
  return { bySlug, main, ageBands }
}

export const EMPTY_TAXONOMY: Taxonomy = { bySlug: new Map(), main: [], ageBands: [] }

/** The top-level ancestor of a category (itself when it is top-level). */
export function rootSlugOf(taxonomy: Taxonomy, slug: string): string | null {
  let current = taxonomy.bySlug.get(slug)
  for (let guard = 0; current?.parentSlug && guard < 20; guard++) current = taxonomy.bySlug.get(current.parentSlug)
  return current?.slug ?? null
}

/** Words of at least 4 letters, compared by their first 5 letters so "ciencia" meets "Ciencias" and "títere" meets "Títeres". */
export const stems = (text: string) => fold(text).split(/[^a-z0-9]+/).filter((w) => w.length >= 4 && !CONNECTORS.has(w)).map((w) => w.slice(0, 5))
/** Whole words of at least 4 letters, accent-free: what a shopper could be naming. */
export const words = (text: string) => fold(text).split(/[^a-z0-9]+/).filter((w) => w.length >= 4 && !CONNECTORS.has(w))
/** True when two words are the same or one typo apart (a letter changed, missing, added, or two swapped). */
export function near(a: string, b: string): boolean {
  if (a === b) return true
  if (Math.abs(a.length - b.length) > 1) return false
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i++
  const rest = (x: string, from: number) => x.slice(from)
  if (a.length === b.length) return rest(a, i + 1) === rest(b, i + 1) || (a[i] === b[i + 1] && a[i + 1] === b[i] && rest(a, i + 2) === rest(b, i + 2))
  return a.length > b.length ? rest(a, i + 1) === rest(b, i) : rest(a, i) === rest(b, i + 1)
}

/**
 * A word without its Spanish ending, so "sumar", "sumas" and "sumando" meet "suma". Rough on purpose: it is only
 * used to find the catalog's own spelling of a word the shopper wrote in another form.
 */
export function rootOf(word: string): string {
  const root = word.replace(/(aciones|acion|amente|mente|ando|iendo|ados|adas|idos|idas|ado|ada|ido|ida|ar|er|ir|es|as|os|s|a|o|e)$/, "")
  return root.length >= 3 ? root : word
}

/** Edit distance between two words, two swapped neighbours counting as one, or `max + 1` as soon as it is known to be larger. */
export function distance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1
  let before: number[] = []
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const row = [i]
    let best = i
    for (let j = 1; j <= b.length; j++) {
      let cell = Math.min(previous[j]! + 1, row[j - 1]! + 1, previous[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1))
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) cell = Math.min(cell, before[j - 2]! + 1)
      row.push(cell)
      if (cell < best) best = cell
    }
    if (best > max) return max + 1
    before = previous
    previous = row
  }
  return previous[b.length]!
}

/**
 * How a Spanish word sounds, so spellings that read the same meet ("girafa" and "jirafa", "yaves" and "llaves"):
 * silent h, b/v, s/z/soft c, k/qu/hard c, y/ll, j/soft g, and doubled letters. Expects an accent-free word. The
 * store's backend corrects its catalog search with the same rules (SpellCorrector.soundKey).
 */
export function soundKey(word: string): string {
  // the word is lowercase, so capitals mark "ch" and a hard "gu" while the other letters change
  return word
    .replace(/ch/g, "C").replace(/h/g, "")
    .replace(/gu([ei])/g, "G$1").replace(/g([ei])/g, "j$1")
    .replace(/qu([ei])/g, "k$1").replace(/c([ei])/g, "s$1").replace(/c/g, "k")
    .replace(/z/g, "s").replace(/v/g, "b").replace(/ll/g, "y").replace(/w/g, "u")
    .replace(/C/g, "ch").replace(/G/g, "g")
    .replace(/(.)\1+/g, "$1")
}

/** A word with its singular and plural spellings, so "juguete" meets "Juguetes" and "balones" meets "Balón". */
export const forms = (word: string) => [word, `${word}s`, `${word}es`, word.replace(/s$/, ""), word.replace(/es$/, "")]
/** Spanish connecting words found in category names ("Circuitos para motricidad"). Language, not catalog data. */
const CONNECTORS = new Set(["para", "como", "sobre", "entre", "desde", "hasta", "todo", "todos", "todas", "otros", "otras", "mas"])

/**
 * True when the question and a category name start with the same word but qualify it differently,
 * e.g. "motricidad gruesa" against "Motricidad fina": same topic, another kind. "Circuitos para motricidad" is not a clash.
 */
export function contradicts(text: string, categoryName: string): boolean {
  const asked = stems(text)
  const name = stems(categoryName)
  if (!asked.length || !name.length || asked[0] !== name[0]) return false
  return name.some((stem) => !asked.includes(stem)) && asked.some((stem) => !name.includes(stem))
}

/** The question's words that the category name does not carry ("grues" for "motricidad gruesa" against "Motricidad fina"). */
export const extraStems = (text: string, categoryName: string) => { const name = stems(categoryName); return stems(text).filter((s) => !name.includes(s)) }

/** Whether a text mentions any of these word stems. */
export const mentions = (text: string, wanted: string[]) => { const own = new Set(stems(text)); return wanted.some((s) => own.has(s)) }

/**
 * The most specific category whose name the shopper used, if any. Age-band categories are left to the age reading.
 * Returns the matched slug and its top-level category.
 */
export function categoryNamedIn(text: string, taxonomy: Taxonomy): { slug: string; root: string; whole: boolean } | null {
  const words = new Set(stems(text))
  if (!words.size) return null
  const ages = new Set(statedBands(taxonomy).map((band) => band.slug))
  let best: { slug: string; hits: number; extra: number; depth: number; size: number; byName: boolean } | null = null
  for (const category of taxonomy.bySlug.values()) {
    if (category.productCount === 0 || ages.has(category.slug)) continue
    const name = stems(category.name)
    const named = name.filter((stem) => words.has(stem)).length
    // every meaningful word of a short name, or most of a long one, must appear in the question…
    const byName = named > 0 && named >= Math.ceil(name.length * 0.6) ? named : 0
    // …or one of the store's keywords for it, whole ("puzzle" for Rompecabezas)
    const byKeyword = Math.max(0, ...(category.keywords ?? []).map((keyword) => { const k = stems(keyword); return k.length > 0 && k.every((stem) => words.has(stem)) ? k.length : 0 }))
    const hits = Math.max(byName, byKeyword)
    if (hits === 0) continue
    const depth = category.parentSlug ? 1 : 0
    // words of its name the shopper did not say: "rompecabezas de madera" is "Rompecabezas en madera", not
    // "Rompecabezas de Colombia en madera"
    const extra = byName >= byKeyword ? name.length - named : 0
    // then the deeper and narrower one: "juegos de encajar" means "Para encajar", not the whole "Juegos" shelf
    const size = category.productCount
    const better = !best || hits > best.hits || (hits === best.hits && (extra < best.extra || (extra === best.extra && (depth > best.depth || (depth === best.depth && size < best.size)))))
    if (better) best = { slug: category.slug, hits, extra, depth, size, byName: byName >= byKeyword }
  }
  if (!best) return null
  // `whole`: the shopper said the category itself, or a keyword that is all they asked for ("puzzles"). A keyword
  // inside a longer question ("rompecabezas del cuerpo humano") only hints at the area.
  return { slug: best.slug, root: rootSlugOf(taxonomy, best.slug) ?? best.slug, whole: best.byName || best.hits >= words.size }
}

export const categoryName = (taxonomy: Taxonomy, slug: string | null) => (slug ? taxonomy.bySlug.get(slug)?.name ?? null : null)

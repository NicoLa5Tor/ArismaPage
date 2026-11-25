// Loads a keyword draft into the database:  DATABASE_URL=… node scripts/load-keywords.cjs [file] [--dry-run]
// It only ADDS keywords to the categories and products found by slug; what the store already wrote in the admin is
// never removed. The file is { "categories": { "<slug>": ["palabra", …] }, "products": { "<slug>": [ … ] } }, either
// part optional, given as the first argument (e.g. ../search/stores/<tienda>-keywords.draft.json).
const { Client } = require('pg')
const fs = require('node:fs')

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const file = args.find(a => !a.startsWith('--'))
if (!file) { console.error('Indica el archivo de palabras: node scripts/load-keywords.cjs ../search/stores/<tienda>-keywords.draft.json'); process.exit(1) }
// the same rules as the admin (catalog/domain/SearchProfile): lower case, 2 to 40 characters, letters, digits and
// spaces, at most 40 per category or product
const clean = raw => String(raw).trim().replace(/\s+/g, ' ').toLowerCase()
const valid = word => word.length >= 2 && word.length <= 40 && /^[\p{L}\p{N}]+( [\p{L}\p{N}]+)*$/u.test(word)
const MAX_KEYWORDS = 40

// the search index picks up changed products by updated_at; a category keyword reaches every product under it
const TARGETS = {
  categories: {
    label: 'categoría', table: 'category', keywords: 'category_keyword', owner: 'category_id',
    touch: `WITH RECURSIVE sub AS (SELECT id FROM category WHERE id=$1 UNION ALL SELECT c.id FROM category c JOIN sub ON c.parent_id=sub.id)
      UPDATE product SET updated_at=now() WHERE id IN (SELECT pc.product_id FROM product_category pc WHERE pc.category_id IN (SELECT id FROM sub))`,
  },
  products: { label: 'producto', table: 'product', keywords: 'product_keyword', owner: 'product_id', touch: 'UPDATE product SET updated_at=now() WHERE id=$1' },
}

async function load(db, target, draft, skipped) {
  let added = 0, touched = 0
  for (const [slug, words] of Object.entries(draft)) {
    const row = (await db.query(`SELECT id FROM ${target.table} WHERE slug=$1`, [slug])).rows[0]
    if (!row) { skipped.push(`${slug}: el ${target.label} no existe`); continue }
    const existing = new Set((await db.query(`SELECT keyword FROM ${target.keywords} WHERE ${target.owner}=$1`, [row.id])).rows.map(r => r.keyword))
    let changed = false
    for (const word of [...new Set((Array.isArray(words) ? words : []).map(clean))]) {
      if (!valid(word)) { skipped.push(`${slug}: «${word}» no es válida`); continue }
      if (existing.has(word)) continue
      if (existing.size >= MAX_KEYWORDS) { skipped.push(`${slug}: ya tiene ${MAX_KEYWORDS} palabras clave`); break }
      await db.query(`INSERT INTO ${target.keywords}(${target.owner}, keyword) VALUES($1,$2)`, [row.id, word])
      existing.add(word); added++; changed = true
    }
    if (changed) { touched++; await db.query(target.touch, [row.id]) }
  }
  return { added, touched }
}

async function main() {
  const draft = JSON.parse(fs.readFileSync(file, 'utf8'))
  const db = new Client({ connectionString: process.env.DATABASE_URL })
  await db.connect()
  const skipped = [], results = {}
  try {
    await db.query('BEGIN')
    for (const [part, target] of Object.entries(TARGETS)) if (draft[part]) results[part] = await load(db, target, draft[part], skipped)
    await db.query(dryRun ? 'ROLLBACK' : 'COMMIT')
  } catch (error) { await db.query('ROLLBACK'); throw error } finally { await db.end() }
  for (const [part, { added, touched }] of Object.entries(results)) {
    const where = part === 'categories' ? 'categorías' : 'productos'
    console.log(`${dryRun ? 'Simulación: se agregarían' : 'Agregadas'} ${added} palabras clave en ${touched} ${where}.`)
  }
  if (skipped.length) console.log(`Sin cargar (${skipped.length}):\n  ${skipped.slice(0, 60).join('\n  ')}${skipped.length > 60 ? `\n  … ${skipped.length - 60} más` : ''}`)
}
main().catch(error => { console.error(error.message); process.exit(1) })

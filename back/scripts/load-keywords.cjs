// Loads a keyword draft into the database:  DATABASE_URL=… node scripts/load-keywords.cjs [file] [--dry-run]
// It only ADDS keywords to categories found by slug; what the store already wrote in the admin is never removed.
// The file is { "categories": { "<slug>": ["palabra", …] } }, by default ../search/stores/arisma-keywords.draft.json.
const { Client } = require('pg')
const fs = require('node:fs')
const path = require('node:path')

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const file = args.find(a => !a.startsWith('--')) || path.join(__dirname, '..', '..', 'search', 'stores', 'arisma-keywords.draft.json')
// the same rules as the admin (catalog/domain/SearchProfile): lower case, 2 to 40 characters, letters, digits and spaces
const clean = raw => String(raw).trim().replace(/\s+/g, ' ').toLowerCase()
const valid = word => word.length >= 2 && word.length <= 40 && /^[\p{L}\p{N}]+( [\p{L}\p{N}]+)*$/u.test(word)
const MAX_PER_CATEGORY = 40

async function main() {
  const draft = JSON.parse(fs.readFileSync(file, 'utf8')).categories || {}
  const db = new Client({ connectionString: process.env.DATABASE_URL })
  await db.connect()
  let added = 0, touched = 0
  const skipped = []
  try {
    await db.query('BEGIN')
    for (const [slug, words] of Object.entries(draft)) {
      const category = (await db.query('SELECT id FROM category WHERE slug=$1', [slug])).rows[0]
      if (!category) { skipped.push(`${slug}: la categoría no existe`); continue }
      const existing = new Set((await db.query('SELECT keyword FROM category_keyword WHERE category_id=$1', [category.id])).rows.map(r => r.keyword))
      let changed = false
      for (const word of [...new Set(words.map(clean))]) {
        if (!valid(word)) { skipped.push(`${slug}: «${word}» no es válida`); continue }
        if (existing.has(word)) continue
        if (existing.size >= MAX_PER_CATEGORY) { skipped.push(`${slug}: ya tiene ${MAX_PER_CATEGORY} palabras clave`); break }
        await db.query('INSERT INTO category_keyword(category_id, keyword) VALUES($1,$2)', [category.id, word])
        existing.add(word); added++; changed = true
      }
      if (changed) {
        touched++
        // the search index picks up changed products by updated_at
        await db.query(`WITH RECURSIVE sub AS (SELECT id FROM category WHERE id=$1 UNION ALL SELECT c.id FROM category c JOIN sub ON c.parent_id=sub.id)
          UPDATE product SET updated_at=now() WHERE id IN (SELECT pc.product_id FROM product_category pc WHERE pc.category_id IN (SELECT id FROM sub))`, [category.id])
      }
    }
    await db.query(dryRun ? 'ROLLBACK' : 'COMMIT')
  } catch (error) { await db.query('ROLLBACK'); throw error } finally { await db.end() }
  console.log(`${dryRun ? 'Simulación: se agregarían' : 'Agregadas'} ${added} palabras clave en ${touched} categorías.`)
  if (skipped.length) console.log(`Sin cargar:\n  ${skipped.join('\n  ')}`)
}
main().catch(error => { console.error(error.message); process.exit(1) })

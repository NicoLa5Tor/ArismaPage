// Import only a local, explicitly selected snapshot. Existing records are never overwritten.
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { Client } = require('pg')
const dir = process.env.CATALOG_DIR
if (!dir || !process.env.DATABASE_URL) throw new Error('Define CATALOG_DIR and DATABASE_URL for the isolated target database')
const products = JSON.parse(fs.readFileSync(path.join(dir, 'products.json'), 'utf8'))
const categories = JSON.parse(fs.readFileSync(path.join(dir, 'categories.json'), 'utf8'))
const media = JSON.parse(fs.readFileSync(path.join(dir, 'media.json'), 'utf8'))
const dry = !process.argv.includes('--apply')
const db = new Client({ connectionString: process.env.DATABASE_URL })
async function main() {
  if (!process.env.DATABASE_URL.includes('arisma_quarkus')) throw new Error('Target database name must contain arisma_quarkus')
  await db.connect(); await db.query('BEGIN')
  const categoryIds = new Map(), errors = [], warnings = []
  let addedProducts = 0, addedCategories = 0
  for (const c of categories) {
    const source = `wordpress:category:${c.term_id}`
    const result = await db.query('INSERT INTO category(id,source_key,name,slug,description) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING RETURNING id', [crypto.randomUUID(),source,c.name,c.slug,c.description || ''])
    const existing = await db.query('SELECT id FROM category WHERE source_key=$1', [source])
    if (!existing.rows.length) { errors.push(`category ${c.term_id}: conflicting slug`); continue }
    categoryIds.set(c.term_id, existing.rows[0].id); addedCategories += result.rowCount
  }
  for (const c of categories) if (c.parent && categoryIds.has(c.parent) && categoryIds.has(c.term_id)) await db.query('UPDATE category SET parent_id=$1 WHERE id=$2 AND parent_id IS NULL', [categoryIds.get(c.parent),categoryIds.get(c.term_id)])
  const mediaById = new Map(media.map(m => [String(m.ID),m]))
  for (const p of products) {
    await db.query('SAVEPOINT product_import')
    try {
      const data=p.commerce || {}, sku=(data._sku || '').trim() || null
      const price=data._price === '' || data._price == null ? null : Number(data._price)
      let stock=data._manage_stock === 'yes' && data._stock !== '' && data._stock != null ? Number(data._stock) : null
      if (stock != null && Number.isInteger(stock) && stock < 0) { warnings.push(`${p.source_key}: negative source stock retained in metadata; target stock left unset`); stock=null }
      if ((price != null && (!Number.isFinite(price) || price < 0)) || (stock != null && (!Number.isInteger(stock) || stock < 0))) throw new Error('invalid price or stock')
      const status=p.status === 'publish' ? 'published' : 'draft'
      const inserted=await db.query('INSERT INTO product(id,source_key,title,slug,description_html,status,sku,price_cop,stock_quantity,quote_only,source_metadata) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT DO NOTHING RETURNING id', [crypto.randomUUID(),p.source_key,p.title,p.handle,p.description_html || '',status,sku,price,stock,data.ratcw_remove_cart_button_for === 'for-all',JSON.stringify(p)])
      if (!inserted.rowCount) {
        const existing=await db.query('SELECT id FROM product WHERE source_key=$1',[p.source_key])
        if (!existing.rowCount) errors.push(`${p.source_key}: conflicting slug or SKU`)
        continue
      }
      addedProducts++
      const id=inserted.rows[0].id
      for (const c of p.categories || []) if (categoryIds.has(c.source_term_id)) await db.query('INSERT INTO product_category VALUES ($1,$2) ON CONFLICT DO NOTHING',[id,categoryIds.get(c.source_term_id)])
      const image=mediaById.get(String(data._thumbnail_id)); if (image && image.guid) await db.query('INSERT INTO product_image(id,product_id,original_url) VALUES ($1,$2,$3)',[crypto.randomUUID(),id,image.guid])
    } catch(e) { await db.query('ROLLBACK TO SAVEPOINT product_import'); errors.push(`${p.source_key}: ${e.message}`) }
  }
  await db.query(dry || errors.length ? 'ROLLBACK' : 'COMMIT')
  console.log(JSON.stringify({dryRun:dry, committed:!dry && !errors.length, addedProducts, addedCategories, warnings, errors},null,2))
  if (errors.length) process.exitCode=1
}
main().catch(e => { console.error(e.message); process.exitCode=1 }).finally(() => db.end())

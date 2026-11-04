// Import the full WooCommerce history (catalog pricing, attributes, gallery, customers, coupons,
// orders, payments, shipping, quotes, notes and the sales stock ledger) from a restored local copy
// of the WordPress database. Dry run by default; --apply commits only when reconciliation passes.
// Existing rows are never overwritten: every record is keyed by source_key and inserted once.
const crypto = require('node:crypto')
const { Client } = require('pg')
const mysql = require('mysql2/promise')
const { unserialize } = require('./lib/php-unserialize.cjs')

const dry = !process.argv.includes('--apply')
const { DATABASE_URL, WP_DATABASE_URL } = process.env
if (!DATABASE_URL || !WP_DATABASE_URL) throw new Error('Define DATABASE_URL (Quarkus Postgres) and WP_DATABASE_URL (restored WordPress copy)')
if (!new URL(DATABASE_URL).pathname.includes('arisma_quarkus')) throw new Error('Target database name must contain arisma_quarkus')
const wpUrl = new URL(WP_DATABASE_URL)
if (!['127.0.0.1', 'localhost'].includes(wpUrl.hostname)) throw new Error('The WordPress source must be a local restored copy, never production')

const TAX_IVA = '5b0f8a52-6a39-4e0e-9a43-2f1c4a6b1901', TAX_EXEMPT = '5b0f8a52-6a39-4e0e-9a43-2f1c4a6b1900'
const ORDER_STATUS = { 'wc-pending': 'pending', 'wc-processing': 'processing', 'wc-on-hold': 'on_hold', 'wc-completed': 'completed', 'wc-cancelled': 'cancelled', 'wc-failed': 'failed', 'wc-refunded': 'refunded' }
const PAID = ['processing', 'completed', 'on_hold']
const QUOTE_STATUS = 'wc-ywraq-new'
const PAYMENT_KEYS = ['_transaction_id', 'Transaction ID', 'Transaccion ID', 'Payment type', 'Tipo de pago', 'Trasability Code', 'Tash Code', 'Extra Data', 'PayU Latam Client email', 'Pagador PayU Latam email']

const db = new Client({ connectionString: DATABASE_URL })
const uuid = () => crypto.randomUUID()
const num = v => (v === '' || v == null || Number.isNaN(Number(v))) ? null : Number(v)
const money = v => num(v) ?? 0
const text = v => (v == null ? '' : String(v)).trim()
const nullable = v => text(v) || null
const unix = v => num(v) ? new Date(num(v) * 1000) : null
const gmt = (dateGmt, dateLocal) => (dateGmt && !String(dateGmt).startsWith('0000')) ? new Date(String(dateGmt).replace(' ', 'T') + 'Z') : new Date(String(dateLocal).replace(' ', 'T') + '-05:00')
const slugify = s => text(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'valor'
const emailKey = e => text(e).toLowerCase() || null
const stats = {}, warnings = [], errors = []
const count = (k, n = 1) => { stats[k] = (stats[k] || 0) + n }
let lastInserted = false

// INSERT ... ON CONFLICT DO NOTHING keyed by source_key; returns the row id either way.
async function once(table, row) {
  const cols = Object.keys(row)
  const r = await db.query(`INSERT INTO ${table}(${cols.join(',')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(',')}) ON CONFLICT DO NOTHING RETURNING id`, cols.map(c => row[c]))
  lastInserted = r.rowCount > 0
  if (r.rowCount) { count(`${table}.inserted`); return r.rows[0].id }
  count(`${table}.existing`)
  if (!row.source_key) return null
  const e = await db.query(`SELECT id FROM ${table} WHERE source_key=$1`, [row.source_key])
  return e.rows[0]?.id ?? null
}
async function guarded(label, fn) {
  await db.query('SAVEPOINT item')
  try { const out = await fn(); await db.query('RELEASE SAVEPOINT item'); return out }
  catch (e) { await db.query('ROLLBACK TO SAVEPOINT item'); errors.push(`${label}: ${e.message}`) }
}

async function main() {
  const wp = await mysql.createConnection({ uri: WP_DATABASE_URL, dateStrings: true, supportBigNumbers: true, bigNumberStrings: true })
  const q = async (sql, params) => (await wp.query(sql, params))[0]
  const metaFor = async types => {
    const map = new Map()
    for (const r of await q(`SELECT m.post_id, m.meta_key, m.meta_value FROM wp_postmeta m JOIN wp_posts p ON p.ID=m.post_id WHERE p.post_type IN (?)`, [types])) {
      if (!map.has(r.post_id)) map.set(r.post_id, {})
      map.get(r.post_id)[r.meta_key] = r.meta_value
    }
    return map
  }
  await db.connect(); await db.query('BEGIN')

  // ---------- Catalog ----------
  const products = await q(`SELECT ID, post_title, post_name, post_content, post_status, post_date, post_date_gmt FROM wp_posts WHERE post_type='product'`)
  const pmeta = await metaFor(['product'])
  const attachments = new Map((await q(`SELECT p.ID, p.guid, (SELECT meta_value FROM wp_postmeta a WHERE a.post_id=p.ID AND a.meta_key='_wp_attachment_image_alt' LIMIT 1) alt FROM wp_posts p WHERE p.post_type='attachment'`)).map(a => [String(a.ID), a]))
  const terms = await q(`SELECT tt.term_taxonomy_id, tt.taxonomy, tt.parent, tt.description, t.term_id, t.name, t.slug FROM wp_term_taxonomy tt JOIN wp_terms t USING(term_id) WHERE tt.taxonomy='product_cat' OR tt.taxonomy LIKE 'pa\\_%'`)
  const rels = await q(`SELECT r.object_id, r.term_taxonomy_id FROM wp_term_relationships r JOIN wp_term_taxonomy tt USING(term_taxonomy_id) WHERE tt.taxonomy='product_cat' OR tt.taxonomy LIKE 'pa\\_%'`)
  const attrLabels = new Map((await q(`SELECT attribute_name, attribute_label FROM wp_woocommerce_attribute_taxonomies`)).map(a => [`pa_${a.attribute_name}`, a.attribute_label]))
  const termsByTt = new Map(terms.map(t => [t.term_taxonomy_id, t]))
  const relsByProduct = new Map()
  for (const r of rels) { if (!relsByProduct.has(r.object_id)) relsByProduct.set(r.object_id, []); relsByProduct.get(r.object_id).push(termsByTt.get(r.term_taxonomy_id)) }

  const categoryIds = new Map()
  for (const c of terms.filter(t => t.taxonomy === 'product_cat')) {
    const id = await once('category', { id: uuid(), source_key: `wordpress:category:${c.term_id}`, name: c.name, slug: c.slug, description: c.description || '' })
    if (id) categoryIds.set(c.term_id, id); else errors.push(`category ${c.term_id}: conflicting slug`)
  }
  for (const c of terms.filter(t => t.taxonomy === 'product_cat' && t.parent)) {
    const parent = termsByTt.get(c.parent) ? termsByTt.get(c.parent).term_id : c.parent
    if (categoryIds.has(parent)) await db.query('UPDATE category SET parent_id=$1 WHERE id=$2 AND parent_id IS NULL', [categoryIds.get(parent), categoryIds.get(c.term_id)])
  }

  const attributeIds = new Map(), valueIds = new Map()
  async function attributeValue(code, name, valueSlug, valueName) {
    if (!attributeIds.has(code)) {
      await db.query('INSERT INTO attribute(id,code,name) VALUES ($1,$2,$3) ON CONFLICT (code) DO NOTHING', [uuid(), code, name])
      attributeIds.set(code, (await db.query('SELECT id FROM attribute WHERE code=$1', [code])).rows[0].id)
    }
    const key = `${code}:${valueSlug}`
    if (!valueIds.has(key)) {
      await db.query('INSERT INTO attribute_value(id,attribute_id,slug,name) VALUES ($1,$2,$3,$4) ON CONFLICT (attribute_id,slug) DO NOTHING', [uuid(), attributeIds.get(code), valueSlug, valueName])
      valueIds.set(key, (await db.query('SELECT id FROM attribute_value WHERE attribute_id=$1 AND slug=$2', [attributeIds.get(code), valueSlug])).rows[0].id)
    }
    return valueIds.get(key)
  }

  const productIds = new Map() // WordPress ID -> product uuid
  for (const p of products) {
    await guarded(`product ${p.ID}`, async () => {
      const m = pmeta.get(p.ID) || {}
      const source = `wordpress:product:${p.ID}`
      let regular = num(m._regular_price), sale = num(m._sale_price)
      if (sale != null && regular != null && sale > regular) { warnings.push(`${source}: sale price above regular price ignored`); sale = null }
      let stock = m._manage_stock === 'yes' ? num(m._stock) : null
      if (stock != null && (stock < 0 || !Number.isInteger(stock))) { warnings.push(`${source}: source stock ${m._stock} not representable; left unset`); stock = null }
      let taxRate = m._tax_status === 'none' ? TAX_EXEMPT : m._tax_class === 'iva' ? TAX_IVA : null
      if (!taxRate) { warnings.push(`${source}: taxable with standard class, which has no rate in WooCommerce; marked exempt`); taxRate = TAX_EXEMPT }
      const pricing = {
        sale_price: sale, sale_starts_at: unix(m._sale_price_dates_from), sale_ends_at: unix(m._sale_price_dates_to), tax_rate_id: taxRate,
        manage_stock: m._manage_stock === 'yes', stock_status: ['instock', 'outofstock', 'onbackorder'].includes(m._stock_status) ? m._stock_status : 'instock',
        backorders: ['notify', 'yes'].includes(m._backorders) ? m._backorders : 'no', hide_price: m.ratcw_hide_price === 'yes', featured: m._featured === 'yes', sold_individually: m._sold_individually === 'yes',
      }
      const existing = (await db.query('SELECT id, tax_rate_id IS NULL AS first_pass, updated_at = created_at AS untouched FROM product WHERE source_key=$1', [source])).rows[0]
      let id, firstPass
      if (!existing) {
        id = uuid(); firstPass = true
        const row = { id, source_key: source, title: p.post_title, slug: p.post_name || slugify(p.post_title), description_html: p.post_content || '', status: p.post_status === 'publish' ? 'published' : 'draft', sku: nullable(m._sku), price_cop: num(m._price), regular_price: regular, stock_quantity: stock, quote_only: m.ratcw_remove_cart_button_for === 'for-all', source_metadata: JSON.stringify({ wordpress_id: p.ID, meta: m }), created_at: gmt(p.post_date_gmt, p.post_date), ...pricing }
        row.updated_at = row.created_at
        const cols = Object.keys(row)
        const r = await db.query(`INSERT INTO product(${cols}) VALUES (${cols.map((_, i) => `$${i + 1}`)}) ON CONFLICT DO NOTHING RETURNING id`, cols.map(c => row[c]))
        if (!r.rowCount) throw new Error('conflicting slug or SKU')
        count('product.inserted')
        for (const t of relsByProduct.get(p.ID) || []) if (t.taxonomy === 'product_cat' && categoryIds.has(t.term_id)) await db.query('INSERT INTO product_category VALUES ($1,$2) ON CONFLICT DO NOTHING', [id, categoryIds.get(t.term_id)])
      } else {
        id = existing.id; firstPass = existing.first_pass
        if (firstPass) {
          const sets = Object.keys(pricing).map((k, i) => `${k}=$${i + 2}`)
          // regular_price was backfilled from _price (the sale price for items on sale); fix it unless an admin already edited the product.
          if (existing.untouched) sets.push(`regular_price=$${sets.length + 2}`)
          await db.query(`UPDATE product SET ${sets.join(',')} WHERE id=$1`, [id, ...Object.values(pricing), ...(existing.untouched ? [regular] : [])])
          if (!existing.untouched) warnings.push(`${source}: edited by an administrator; regular price kept`)
          count('product.enriched')
        } else count('product.already_enriched')
      }
      productIds.set(String(p.ID), id)
      if (!firstPass) return
      // Gallery: thumbnail first, then the gallery in its WooCommerce order.
      const gallery = [m._thumbnail_id, ...text(m._product_image_gallery).split(',')].map(text).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i)
      for (const [position, attachmentId] of gallery.entries()) {
        const a = attachments.get(attachmentId)
        if (!a?.guid) continue
        const has = await db.query('SELECT id FROM product_image WHERE product_id=$1 AND original_url=$2', [id, a.guid])
        if (has.rowCount) { await db.query('UPDATE product_image SET alt=$2 WHERE id=$1 AND alt=\'\'', [has.rows[0].id, text(a.alt)]); continue }
        const pos = (await db.query('SELECT COALESCE(MAX(position)+1,0) p FROM product_image WHERE product_id=$1', [id])).rows[0].p
        await db.query('INSERT INTO product_image(id,product_id,original_url,position,alt,is_primary) VALUES ($1,$2,$3,$4,$5,$6)', [uuid(), id, a.guid, pos, text(a.alt), pos === 0 && position === 0])
        count('product_image.inserted')
      }
      // Attributes: taxonomy terms plus custom (non-taxonomy) attributes from _product_attributes.
      for (const t of relsByProduct.get(p.ID) || []) if (t.taxonomy.startsWith('pa_')) {
        const v = await attributeValue(t.taxonomy.slice(3), attrLabels.get(t.taxonomy) || t.taxonomy.slice(3), t.slug, t.name)
        await db.query('INSERT INTO product_attribute_value VALUES ($1,$2) ON CONFLICT DO NOTHING', [id, v]); count('product_attribute_value.inserted')
      }
      for (const [key, a] of Object.entries(unserialize(m._product_attributes) || {})) if (a && !a.is_taxonomy && text(a.value)) {
        for (const value of text(a.value).split('|').map(text).filter(Boolean)) {
          const v = await attributeValue(slugify(key), text(a.name) || key, slugify(value), value)
          await db.query('INSERT INTO product_attribute_value VALUES ($1,$2) ON CONFLICT DO NOTHING', [id, v]); count('product_attribute_value.inserted')
        }
      }
    })
  }

  // ---------- Customers ----------
  const users = await q(`SELECT u.ID, u.user_email, u.user_registered FROM wp_users u JOIN wp_usermeta c ON c.user_id=u.ID AND c.meta_key='wp_capabilities' AND c.meta_value LIKE '%customer%'`)
  const umeta = new Map()
  for (const r of await q(`SELECT user_id, meta_key, meta_value FROM wp_usermeta WHERE meta_key IN ('first_name','last_name') OR meta_key LIKE 'billing\\_%' OR meta_key LIKE 'shipping\\_%'`)) {
    if (!umeta.has(r.user_id)) umeta.set(r.user_id, {}); umeta.get(r.user_id)[r.meta_key] = r.meta_value
  }
  const customerByUser = new Map(), customerByEmail = new Map()
  async function address(customerId, kind, a) {
    if (!text(a.address_1) && !text(a.city)) return
    const r = await db.query('INSERT INTO address(id,customer_id,kind,first_name,last_name,line1,line2,city,state,postcode,country,phone) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT (customer_id,kind) DO NOTHING',
      [uuid(), customerId, kind, text(a.first_name), text(a.last_name), text(a.address_1), text(a.address_2), text(a.city), text(a.state), text(a.postcode), text(a.country) || 'CO', nullable(a.phone)])
    count('address.inserted', r.rowCount)
  }
  const pick = (m, prefix) => Object.fromEntries(['first_name', 'last_name', 'company', 'address_1', 'address_2', 'city', 'state', 'postcode', 'country', 'phone', 'email', 'id', 'id_type'].map(k => [k, m[`${prefix}${k}`]]))
  async function upsertCustomer(row) {
    const id = await once('customer', row)
    if (id) return id
    if (row.email) { const e = await db.query('SELECT id FROM customer WHERE lower(email)=lower($1)', [row.email]); if (e.rowCount) return e.rows[0].id }
    throw new Error('customer conflict')
  }
  for (const u of users) {
    await guarded(`user ${u.ID}`, async () => {
      const m = umeta.get(u.ID) || {}, b = pick(m, 'billing_')
      const id = await upsertCustomer({ id: uuid(), source_key: `wordpress:user:${u.ID}`, wp_user_id: u.ID, email: emailKey(u.user_email), first_name: text(m.first_name || b.first_name), last_name: text(m.last_name || b.last_name), phone: nullable(b.phone), document_type: nullable(b.id_type), document_number: nullable(b.id), company: nullable(b.company), has_account: true, created_at: gmt(u.user_registered, u.user_registered) })
      customerByUser.set(String(u.ID), id); if (emailKey(u.user_email)) customerByEmail.set(emailKey(u.user_email), id)
      await address(id, 'billing', b); await address(id, 'shipping', pick(m, 'shipping_'))
    })
  }

  // ---------- Coupons ----------
  const cmeta = await metaFor(['shop_coupon'])
  for (const k of await q(`SELECT ID, post_title, post_excerpt, post_status, post_date, post_date_gmt FROM wp_posts WHERE post_type='shop_coupon'`)) {
    await guarded(`coupon ${k.ID}`, async () => {
      const m = cmeta.get(k.ID) || {}, limit = n => num(n) > 0 ? num(n) : null
      await once('coupon', { id: uuid(), source_key: `wordpress:coupon:${k.ID}`, code: text(k.post_title), kind: ['percent', 'fixed_product'].includes(m.discount_type) ? m.discount_type : 'fixed_cart', amount: money(m.coupon_amount),
        minimum_amount: num(m.minimum_amount), maximum_amount: num(m.maximum_amount), usage_limit: limit(m.usage_limit), usage_limit_per_customer: limit(m.usage_limit_per_user), individual_use: m.individual_use === 'yes',
        free_shipping: m.free_shipping === 'yes', exclude_sale_items: m.exclude_sale_items === 'yes', expires_at: unix(m.date_expires), active: k.post_status === 'publish', description: text(k.post_excerpt), created_at: gmt(k.post_date_gmt, k.post_date) })
    })
  }

  // ---------- Orders and quotes ----------
  const orders = await q(`SELECT ID, post_status, post_date, post_date_gmt, post_excerpt FROM wp_posts WHERE post_type='shop_order' ORDER BY post_date`)
  const ometa = await metaFor(['shop_order'])
  const items = new Map(), itemMeta = new Map()
  for (const r of await q(`SELECT order_item_id, order_id, order_item_name, order_item_type FROM wp_woocommerce_order_items`)) { if (!items.has(r.order_id)) items.set(r.order_id, []); items.get(r.order_id).push(r) }
  for (const r of await q(`SELECT order_item_id, meta_key, meta_value FROM wp_woocommerce_order_itemmeta`)) { if (!itemMeta.has(r.order_item_id)) itemMeta.set(r.order_item_id, {}); itemMeta.get(r.order_item_id)[r.meta_key] = r.meta_value }
  const notes = new Map()
  for (const r of await q(`SELECT comment_ID, comment_post_ID, comment_author, comment_content, comment_date, comment_date_gmt FROM wp_comments WHERE comment_type='order_note'`)) { if (!notes.has(r.comment_post_ID)) notes.set(r.comment_post_ID, []); notes.get(r.comment_post_ID).push(r) }
  const skuByProduct = new Map(products.map(p => [String(p.ID), nullable((pmeta.get(p.ID) || {})._sku)]))

  // Guests (no account) are grouped by email using their most recent order's billing data.
  for (const o of [...orders].reverse()) {
    const m = ometa.get(o.ID) || {}
    const email = emailKey(m._billing_email || m.ywraq_customer_email)
    if (!email || customerByEmail.has(email) || customerByUser.has(String(m._customer_user))) continue
    await guarded(`guest from order ${o.ID}`, async () => {
      const b = pick(m, '_billing_'), name = text(m.ywraq_customer_name).split(' ')
      const id = await upsertCustomer({ id: uuid(), source_key: `wordpress:guest:${crypto.createHash('sha256').update(email).digest('hex').slice(0, 24)}`, email, first_name: text(b.first_name) || name[0] || '', last_name: text(b.last_name) || name.slice(1).join(' '), phone: nullable(b.phone), document_type: nullable(b.id_type), document_number: nullable(b.id), company: nullable(b.company), has_account: false, created_at: gmt(o.post_date_gmt, o.post_date) })
      customerByEmail.set(email, id)
      await address(id, 'billing', b); await address(id, 'shipping', pick(m, '_shipping_'))
    })
  }
  const customerFor = m => customerByUser.get(String(m._customer_user)) || customerByEmail.get(emailKey(m._billing_email || m.ywraq_customer_email)) || null
  const lineValues = (it, im) => {
    const qty = Math.round(money(im._qty)), subtotal = money(im._line_subtotal), total = money(im._line_total), tax = money(im._line_tax)
    return { product_id: productIds.get(text(im._product_id)) || null, sku: nullable(im._ywpi_product_sku) || skuByProduct.get(text(im._product_id)) || null, title: it.order_item_name, quantity: qty, unit_price: qty ? Math.round(subtotal / qty * 100) / 100 : 0, subtotal, total, tax }
  }

  for (const o of orders) {
    const m = ometa.get(o.ID) || {}
    const isQuote = o.post_status === QUOTE_STATUS, fromQuote = isQuote || m._created_via === 'ywraq'
    await guarded(`order ${o.ID}`, async () => {
      const placed = gmt(o.post_date_gmt, o.post_date), customerId = customerFor(m), its = items.get(o.ID) || []
      let orderId = null, quoteId = null
      if (!isQuote) {
        const status = ORDER_STATUS[o.post_status]
        if (!status) throw new Error(`unknown status ${o.post_status}`)
        const lines = its.filter(i => i.order_item_type === 'line_item')
        const subtotal = lines.reduce((s, i) => s + money((itemMeta.get(i.order_item_id) || {})._line_subtotal), 0)
        const billing = pick(m, '_billing_'), shipping = pick(m, '_shipping_')
        orderId = await once('sales_order', {
          id: uuid(), source_key: `wordpress:order:${o.ID}`, number: String(o.ID), customer_id: customerId, status, currency: m._order_currency || 'COP',
          subtotal, discount_total: money(m._cart_discount), shipping_total: money(m._order_shipping), tax_total: money(m._order_tax) + money(m._order_shipping_tax), total: money(m._order_total),
          prices_include_tax: m._prices_include_tax === 'yes', payment_method: nullable(m._payment_method), payment_method_title: nullable(m._payment_method_title), created_via: nullable(m._created_via),
          placed_at: placed, paid_at: unix(m._date_paid), completed_at: unix(m._date_completed), billing: JSON.stringify(billing), shipping: JSON.stringify(shipping), customer_note: text(o.post_excerpt),
          source_metadata: JSON.stringify({ wordpress_id: o.ID, meta: m }), updated_at: placed,
        })
        const newOrder = lastInserted
        for (const it of its) {
          const im = itemMeta.get(it.order_item_id) || {}, source_key = `wordpress:order_item:${it.order_item_id}`
          if (it.order_item_type === 'line_item') {
            const v = lineValues(it, im)
            const lineId = await once('order_line', { id: uuid(), order_id: orderId, ...v, discount: v.subtotal - v.total, tax_rate_percent: v.tax > 0 ? 19 : 0, stock_reduced: Math.round(money(im._reduced_stock)), source_key })
            const reduced = Math.round(money(im._reduced_stock))
            if (reduced > 0 && v.product_id) await once('inventory_adjustment', { id: uuid(), product_id: v.product_id, kind: 'sale', order_line_id: lineId, quantity_delta: -reduced, reason: `Venta pedido #${o.ID}`, created_at: unix(m._date_paid) || placed, source_key: `wordpress:stock:${it.order_item_id}` })
          } else if (it.order_item_type === 'shipping') {
            await once('order_shipping', { id: uuid(), order_id: orderId, method: text(im.method_id) || 'unknown', label: it.order_item_name, cost: money(im.cost), tax: money(im.total_tax), tracking_code: nullable(m.ywot_tracking_code), carrier: nullable(m.ywot_carrier_id), picked_up_at: m.ywot_picked_up === 'on' ? unix(m.ywot_pick_up_date) : null, source_key })
          } else if (it.order_item_type === 'coupon') {
            const coupon = await db.query('SELECT id FROM coupon WHERE lower(code)=lower($1)', [it.order_item_name])
            await once('order_discount', { id: uuid(), order_id: orderId, coupon_id: coupon.rows[0]?.id || null, code: it.order_item_name, amount: money(im.discount_amount), tax: money(im.discount_amount_tax), source_key })
          }
        }
        const raw = Object.fromEntries(PAYMENT_KEYS.filter(k => text(m[k])).map(k => [k, m[k]]))
        const externalId = nullable(m._transaction_id || m['Transaction ID'] || m['Transaccion ID'])
        if (m._payment_method && (externalId || m._date_paid)) await once('payment_transaction', { id: uuid(), order_id: orderId, provider: m._payment_method, external_id: externalId, payment_type: nullable(m['Payment type'] || m['Tipo de pago']), status: PAID.includes(status) || status === 'refunded' ? 'approved' : status, amount: money(m._order_total), paid_at: unix(m._date_paid), raw: JSON.stringify(raw), source_key: `wordpress:payment:${o.ID}` })
        if (newOrder) await once('order_status_history', { id: uuid(), order_id: orderId, from_status: null, to_status: status, note: 'Estado importado de WooCommerce', created_at: unix(m._date_completed) || unix(m._date_paid) || placed })
      }
      if (fromQuote) {
        const lines = its.filter(i => i.order_item_type === 'line_item')
        const raqStatus = text(m.ywraq_raq_status)
        quoteId = await once('quote_request', {
          id: uuid(), source_key: `wordpress:quote:${o.ID}`, number: `C-${o.ID}`, customer_id: customerId, name: text(m.ywraq_customer_name || `${text(m._billing_first_name)} ${text(m._billing_last_name)}`), email: emailKey(m.ywraq_customer_email || m._billing_email), message: text(m.ywraq_customer_message),
          status: !isQuote ? 'converted' : raqStatus === 'accepted' ? 'accepted' : 'pending', order_id: orderId,
          subtotal: lines.reduce((s, i) => s + money((itemMeta.get(i.order_item_id) || {})._line_subtotal), 0), tax_total: money(m._order_tax), total: money(m._order_total),
          expires_at: text(m._ywcm_request_expire) ? new Date(`${m._ywcm_request_expire}T23:59:59-05:00`) : null, created_at: placed, updated_at: placed, source_metadata: JSON.stringify({ wordpress_id: o.ID, meta: m }),
        })
        for (const it of lines) {
          const v = lineValues(it, itemMeta.get(it.order_item_id) || {})
          if (v.quantity <= 0) { warnings.push(`quote ${o.ID}: line ${it.order_item_id} without quantity skipped`); continue }
          await once('quote_line', { id: uuid(), quote_id: quoteId, product_id: v.product_id, sku: v.sku, title: v.title, quantity: v.quantity, unit_price: v.unit_price, total: v.total, source_key: `wordpress:quote_item:${it.order_item_id}` })
        }
      }
      for (const n of notes.get(o.ID) || []) await once('order_note', { id: uuid(), order_id: orderId, quote_id: orderId ? null : quoteId, body: text(n.comment_content), author: text(n.comment_author), created_at: gmt(n.comment_date_gmt, n.comment_date), source_key: `wordpress:note:${n.comment_ID}` })
    })
  }

  // ---------- Reconciliation (inside the transaction, before deciding to commit) ----------
  const src = {
    orders: orders.filter(o => o.post_status !== QUOTE_STATUS).length,
    quotes: orders.filter(o => o.post_status === QUOTE_STATUS || (ometa.get(o.ID) || {})._created_via === 'ywraq').length,
    lines: orders.filter(o => o.post_status !== QUOTE_STATUS).reduce((s, o) => s + (items.get(o.ID) || []).filter(i => i.order_item_type === 'line_item').length, 0),
  }
  const tgt = (await db.query(`SELECT (SELECT count(*) FROM sales_order WHERE source_key LIKE 'wordpress:order:%')::int orders, (SELECT count(*) FROM quote_request WHERE source_key LIKE 'wordpress:quote:%')::int quotes, (SELECT count(*) FROM order_line WHERE source_key LIKE 'wordpress:order_item:%')::int lines`)).rows[0]
  for (const k of Object.keys(src)) if (src[k] !== tgt[k]) errors.push(`reconciliation ${k}: source ${src[k]} vs target ${tgt[k]}`)
  const srcYears = await q(`SELECT YEAR(p.post_date) y, ROUND(SUM(t.meta_value)) total, COUNT(*) n FROM wp_posts p JOIN wp_postmeta t ON t.post_id=p.ID AND t.meta_key='_order_total' WHERE p.post_type='shop_order' AND p.post_status IN ('wc-processing','wc-completed','wc-on-hold') GROUP BY 1 ORDER BY 1`)
  const tgtYears = new Map((await db.query(`SELECT extract(year FROM placed_at AT TIME ZONE 'America/Bogota')::int y, round(sum(total))::bigint total, count(*)::int n FROM v_paid_order WHERE source_key LIKE 'wordpress:order:%' GROUP BY 1`)).rows.map(r => [r.y, r]))
  const salesByYear = srcYears.map(r => ({ year: Number(r.y), source: Number(r.total), target: Number(tgtYears.get(Number(r.y))?.total ?? 0), orders: Number(r.n) }))
  for (const r of salesByYear) if (Math.abs(r.source - r.target) > 1) errors.push(`reconciliation sales ${r.year}: source ${r.source} vs target ${r.target}`)
  const srcUnits = await q(`SELECT pid.meta_value product, ROUND(SUM(qt.meta_value)) units FROM wp_woocommerce_order_items i JOIN wp_posts o ON o.ID=i.order_id AND o.post_status IN ('wc-processing','wc-completed','wc-on-hold') JOIN wp_woocommerce_order_itemmeta pid ON pid.order_item_id=i.order_item_id AND pid.meta_key='_product_id' JOIN wp_woocommerce_order_itemmeta qt ON qt.order_item_id=i.order_item_id AND qt.meta_key='_qty' WHERE i.order_item_type='line_item' GROUP BY 1`)
  const tgtUnits = new Map((await db.query('SELECT product_id, units::int FROM v_product_sales')).rows.map(r => [r.product_id, r.units]))
  const unitMismatches = srcUnits.filter(r => Number(r.units) !== (tgtUnits.get(productIds.get(String(r.product))) ?? 0)).length
  if (unitMismatches) errors.push(`reconciliation units: ${unitMismatches} products differ`)

  await db.query(dry || errors.length ? 'ROLLBACK' : 'COMMIT')
  console.log(JSON.stringify({ dryRun: dry, committed: !dry && !errors.length, stats, reconciliation: { source: src, target: tgt, salesByYear, productsWithSales: srcUnits.length, unitMismatches }, warnings: warnings.length > 40 ? [...warnings.slice(0, 40), `… ${warnings.length - 40} more`] : warnings, errors }, null, 2))
  if (errors.length) process.exitCode = 1
  await wp.end()
}
main().catch(e => { console.error(e.message); process.exitCode = 1 }).finally(() => db.end())

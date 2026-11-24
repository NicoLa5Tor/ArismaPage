// End-to-end check of automatic shipment tracking against a running local backend, with a fake 17TRACK served
// here on port 9099. Start the backend with NORPRESS_TRACKING_KEY=smoke and NORPRESS_TRACKING_URL=http://127.0.0.1:9099
// (and NORPRESS_TRACKING_PLAN unset: free plan). It uses a temporary admin and order, and puts back what it touched.
//   DATABASE_URL=postgres://... node scripts/tracking-smoke-test.cjs
const { Client } = require('pg')
const crypto = require('node:crypto')
const http = require('node:http')
const db = new Client({ connectionString: process.env.DATABASE_URL })
const api = 'http://127.0.0.1:9001/api'
const tag = crypto.randomUUID().slice(0, 8)
const adminId = crypto.randomUUID(), adminEmail = `smoke-admin-${tag}@example.invalid`, adminPass = crypto.randomBytes(24).toString('hex')
const salt = crypto.randomBytes(16), adminHash = `pbkdf2-sha256$600000$${salt.toString('hex')}$${crypto.pbkdf2Sync(adminPass, salt, 600000, 32, 'sha256').toString('hex')}`
const shopperEmail = `smoke-envio-${tag}@example.invalid`, guide = '24' + String(Date.now()).slice(-10)
const ok = (cond, msg) => { if (!cond) throw new Error('FALLA: ' + msg); console.log('ok  ' + msg) }
const saved = {}; let number = null

// fake 17TRACK: what it was asked, and what it answers about the guide
const fake = { registered: [], token: null, status: 'InTransit', events: [] }
const server = http.createServer((req, res) => {
  let body = ''
  req.on('data', c => { body += c })
  req.on('end', () => {
    fake.token = req.headers['17token']
    const items = JSON.parse(body || '[]')
    let data
    if (req.url.endsWith('/register')) { fake.registered.push(...items); data = { accepted: items.map(i => ({ origin: 2, number: i.number, carrier: i.carrier })), rejected: [] } }
    else if (req.url.endsWith('/gettrackinfo')) data = { accepted: items.map(i => ({ number: i.number, carrier: i.carrier, track_info: { latest_status: { status: fake.status, sub_status: '' }, tracking: { providers: [{ provider: { key: 100491 }, events: fake.events }] } } })), rejected: [] }
    else { res.writeHead(404).end(); return }
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ code: 0, data }))
  })
})

async function call(method, path, { body, cookie, csrf } = {}) {
  const h = {}
  if (body !== undefined) h['Content-Type'] = 'application/json'
  if (cookie) h.cookie = cookie
  if (csrf) h['X-CSRF-Token'] = csrf
  const r = await fetch(api + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) })
  const text = await r.text(); let json = null; try { json = JSON.parse(text) } catch {}
  return { status: r.status, json, text, cookie: (r.headers.getSetCookie?.() || []).map(c => c.split(';')[0]).filter(c => !c.endsWith('=')).join('; ') }
}

async function main() {
  await new Promise(r => server.listen(9099, '127.0.0.1', r))
  await db.connect()
  await db.query("INSERT INTO admin_user(id,email,name,role,password_hash) VALUES($1,$2,'Smoke envíos','admin',$3)", [adminId, adminEmail, adminHash])
  for (const k of ['payments', 'tracking']) saved[k] = (await db.query('SELECT value FROM store_setting WHERE key=$1', [k])).rows[0]
  saved.manual = (await db.query("SELECT * FROM payment_credential WHERE code='manual'")).rows
  const product = (await db.query("SELECT id FROM product WHERE status='published' AND NOT hide_price AND NOT quote_only AND regular_price > 60000 AND NOT manage_stock ORDER BY title LIMIT 1")).rows[0]

  const login = await call('POST', '/admin/session', { body: { email: adminEmail, password: adminPass } })
  const A = { cookie: login.cookie, csrf: login.json.csrf }
  ok(login.status === 200, 'el admin entra')
  ok((await call('PUT', '/admin/tracking', { ...A, body: { enabled: false } })).json.enabled === false, 'el seguimiento arranca apagado')
  const status = await call('GET', '/admin/tracking', A)
  ok(status.json.ready && status.json.plan === 'free' && status.json.limit === 10, 'el servidor tiene la llave y el plan gratis da 10 envíos al mes')

  // a paid order shipped with Inter Rapidísimo
  await call('PUT', '/admin/settings/payments/manual/live', { ...A, body: { config: { instructions: 'Transfiere a la cuenta que te enviamos.' }, secrets: {} } })
  ok((await call('PUT', '/admin/settings/payments', { ...A, body: { active: 'manual', mode: 'live' } })).status === 200, 'se activa la transferencia')
  const buyer = { firstName: 'Prueba', lastName: 'Envío', email: shopperEmail, phone: '3001234567', documentType: 'CC', documentNumber: '1020304050', company: '', pickup: false, address: 'Calle 1 # 2-3', addressDetail: '', city: 'Medellín', state: 'CO-ANT', note: '' }
  const placed = await call('POST', '/public/checkout/orders', { body: { lines: [{ productId: product.id, quantity: 1 }], buyer, acceptsTerms: true } })
  number = placed.json && placed.json.number
  ok(placed.status === 201, 'se crea el pedido ' + number)
  const orderId = (await db.query('SELECT id FROM sales_order WHERE number=$1', [number])).rows[0].id
  ok((await call('POST', `/admin/orders/${orderId}/payment`, { ...A, body: { reference: 'TRF-' + tag } })).status === 200, 'se registra el pago')
  const shipped = await call('POST', `/admin/orders/${orderId}/shipment/status`, { ...A, body: { status: 'shipped', carrier: 'Interrapidísimo', trackingCode: guide } })
  ok(shipped.status === 200 && shipped.json.status === 'shipped' && shipped.json.tracking === null, 'se despacha con guía y aún no se sigue')
  const mail = (await db.query("SELECT body_html FROM mail_outbox WHERE recipient=$1 AND kind='pedido_despachado'", [shopperEmail])).rows[0]
  ok(mail && mail.body_html.includes('https://www.interrapidisimo.com/') && mail.body_html.includes(guide), 'el correo de despacho trae el enlace de Inter y la guía')

  const off = await call('POST', `/admin/orders/${orderId}/shipment/tracking`, A)
  ok(off.status === 400 && off.json.error.includes('apagado'), 'con el seguimiento apagado no se consulta')
  ok((await call('PUT', '/admin/tracking', { ...A, body: { enabled: true } })).json.enabled, 'el admin activa el seguimiento')

  fake.events = [{ time_utc: '2026-11-13T14:00:00Z', time_iso: '2026-11-13T09:00:00-05:00', description: 'En centro de distribución', location: 'BOGOTA' },
                 { time_utc: '2026-11-12T23:00:00Z', time_iso: '2026-11-12T18:00:00-05:00', description: 'Admitido', location: 'BOGOTA' }]
  const first = await call('POST', `/admin/orders/${orderId}/shipment/tracking`, A)
  ok(first.status === 200 && first.json.tracking.stage === 'in_transit' && first.json.tracking.events.length === 2, 'Actualizar registra la guía y trae dos movimientos')
  ok(fake.registered.length === 1 && fake.registered[0].number === guide && fake.registered[0].carrier === 100491 && fake.token === 'smoke', '17TRACK recibe la guía con el código de Inter y la llave')
  const used = await call('GET', '/admin/tracking', A)
  ok(used.json.used >= 1 && used.json.remaining === used.json.limit - used.json.used, 'el envío cuenta en el mes')

  const keyRow = (await db.query('SELECT o.number FROM sales_order o WHERE o.id=$1', [orderId])).rows[0]
  const pub = await call('GET', `/public/orders/${keyRow.number}?clave=${placed.json.key}`)
  ok(pub.status === 200 && pub.json.tracking.stage === 'in_transit' && pub.json.tracking.events[0].description === 'En centro de distribución', 'el cliente ve el paso a paso en su pedido')

  const again = await call('POST', `/admin/orders/${orderId}/shipment/tracking`, A)
  ok(again.json.tracking.events.length === 2 && fake.registered.length === 1, 'consultar otra vez no duplica movimientos ni registra de nuevo')

  fake.status = 'Delivered'
  fake.events = [{ time_utc: '2026-11-14T16:00:00Z', description: 'Entregado', location: 'MEDELLIN' }, ...fake.events]
  const done = await call('POST', `/admin/orders/${orderId}/shipment/tracking`, A)
  ok(done.json.status === 'delivered' && done.json.tracking.state === 'finished', 'la entrega confirmada cierra el envío')
  ok((await db.query('SELECT status FROM sales_order WHERE id=$1', [orderId])).rows[0].status === 'completed', 'y completa el pedido')
  console.log('\nTODO BIEN')
}

async function cleanup() {
  try {
    if (number) {
      const o = (await db.query('SELECT id FROM sales_order WHERE number=$1', [number])).rows[0]
      if (o) {
        await db.query('DELETE FROM tracking_registration WHERE shipment_id IN (SELECT id FROM shipment WHERE order_id=$1)', [o.id])
        await db.query('DELETE FROM inventory_adjustment WHERE order_line_id IN (SELECT id FROM order_line WHERE order_id=$1)', [o.id])
        await db.query('DELETE FROM sales_order WHERE id=$1', [o.id])
      }
    }
    const acc = (await db.query('SELECT id, customer_id FROM customer_account WHERE email=$1', [shopperEmail])).rows[0]
    if (acc) await db.query('DELETE FROM customer_account WHERE id=$1', [acc.id])
    await db.query("DELETE FROM customer WHERE email=$1 AND NOT EXISTS (SELECT 1 FROM sales_order s WHERE s.customer_id=customer.id)", [shopperEmail]).catch(() => {})
    await db.query('DELETE FROM mail_outbox WHERE recipient=$1', [shopperEmail])
    for (const k of ['payments', 'tracking']) { if (saved[k]) await db.query('UPDATE store_setting SET value=$2, updated_by=NULL WHERE key=$1', [k, saved[k].value]); else await db.query('DELETE FROM store_setting WHERE key=$1', [k]) }
    await db.query("DELETE FROM payment_credential WHERE code='manual'")
    for (const c of saved.manual || []) await db.query('INSERT INTO payment_credential(code,environment,public_config,secret_cipher) VALUES($1,$2,$3,$4)', [c.code, c.environment, c.public_config, c.secret_cipher])
    await db.query('DELETE FROM admin_user WHERE id=$1', [adminId])
  } catch (e) { console.error('limpieza incompleta:', e.message) }
  await db.end()
  server.close()
}
main().catch(e => { console.error(e.message); process.exitCode = 1 }).finally(cleanup)

// End-to-end check of the public store against a running local backend: payments setup (tests and production),
// shopper account (register, confirm email, reset password, session), reviews, coupon, checkout, payments (Wompi
// events, PayU confirmation and return, transfer registered by hand), "Mis pedidos" and the outbox.
// It uses a temporary admin, shopper and coupon, and puts everything it touched back as it was.
//   DATABASE_URL=postgres://... node scripts/store-smoke-test.cjs
const { Client } = require('pg')
const crypto = require('node:crypto')
const db = new Client({ connectionString: process.env.DATABASE_URL })
const api = 'http://127.0.0.1:9001/api'
const tag = crypto.randomUUID().slice(0, 8)
const adminId = crypto.randomUUID(), adminEmail = `smoke-admin-${tag}@example.invalid`, adminPass = crypto.randomBytes(24).toString('hex')
const salt = crypto.randomBytes(16), adminHash = `pbkdf2-sha256$600000$${salt.toString('hex')}$${crypto.pbkdf2Sync(adminPass, salt, 600000, 32, 'sha256').toString('hex')}`
const shopperEmail = `smoke-cliente-${tag}@example.invalid`, couponCode = `SMOKE${tag.toUpperCase()}`
const PAYU_KEY = '4Vj8eK4rloUd272L48hsrarnUA'
const sha = (t) => crypto.createHash('sha256').update(t).digest('hex')
const md5 = (t) => crypto.createHash('md5').update(t).digest('hex')
// A minimal SMTP server on this machine that keeps what it receives, to check the invoice email without a real one.
function smtpSink() {
  const received = []
  const server = require('node:net').createServer((socket) => {
    let data = false, buffer = ''
    socket.write('220 sink\r\n')
    socket.on('data', (chunk) => {
      buffer += chunk.toString('latin1')
      if (data) {
        const end = buffer.indexOf('\r\n.\r\n')
        if (end < 0) return
        received.push(buffer.slice(0, end)); buffer = buffer.slice(end + 5); data = false; socket.write('250 ok\r\n')
      }
      let line
      while (!data && (line = buffer.indexOf('\r\n')) >= 0) {
        const cmd = buffer.slice(0, line).toUpperCase(); buffer = buffer.slice(line + 2)
        if (cmd.startsWith('EHLO')) socket.write('250-sink\r\n250 OK\r\n')
        else if (cmd === 'DATA') { data = true; socket.write('354 go\r\n') }
        else if (cmd === 'QUIT') { socket.end('221 bye\r\n') }
        else socket.write('250 ok\r\n')
      }
    })
  })
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ port: server.address().port, received, close: () => server.close() })))
}
const ok = (cond, msg) => { if (!cond) throw new Error('FALLA: ' + msg); console.log('ok  ' + msg) }
const orders = [], saved = {}

async function call(method, path, { body, cookie, csrf, form } = {}) {
  const h = {}
  if (body !== undefined) h['Content-Type'] = 'application/json'
  if (form) h['Content-Type'] = 'application/x-www-form-urlencoded'
  if (cookie) h.cookie = cookie
  if (csrf) h['X-CSRF-Token'] = csrf
  const r = await fetch(api + path, { method, headers: h, body: form ? new URLSearchParams(form).toString() : body === undefined ? undefined : JSON.stringify(body) })
  const text = await r.text(); let json = null; try { json = JSON.parse(text) } catch {}
  return { status: r.status, json, text, cookie: (r.headers.getSetCookie?.() || []).map(c => c.split(';')[0]).filter(c => !c.endsWith('=')).join('; ') }
}
async function outboxLink(A, kind, path) {
  const box = await call('GET', '/admin/mail/outbox?limit=20', A)
  const mail = box.json.items.find(i => i.kind === kind && i.recipient === shopperEmail)
  const match = mail && mail.bodyHtml.match(new RegExp(`${path}\\?token=([A-Za-z0-9_-]+)`))
  return match ? match[1] : null
}

async function main() {
  await db.connect()
  await db.query("INSERT INTO admin_user(id,email,name,role,password_hash) VALUES($1,$2,'Smoke tienda','admin',$3)", [adminId, adminEmail, adminHash])
  for (const k of ['payments', 'conversations', 'mail', 'mail_secret']) saved[k] = (await db.query('SELECT value FROM store_setting WHERE key=$1', [k])).rows[0]
  saved.credentials = (await db.query('SELECT * FROM payment_credential')).rows
  // start from a store with no payment method set up; what was there comes back at the end
  await db.query('DELETE FROM payment_credential'); await db.query("DELETE FROM store_setting WHERE key='payments'")
  await db.query("INSERT INTO coupon(id,code,kind,amount,active,description) VALUES(gen_random_uuid(),$1,'percent',10,true,'Prueba automática')", [couponCode])
  const product = (await db.query("SELECT id, slug FROM product WHERE status='published' AND NOT hide_price AND NOT quote_only AND regular_price > 60000 AND NOT manage_stock AND page_sections = '{}'::jsonb ORDER BY title LIMIT 1")).rows[0]
  const tracked = (await db.query("SELECT id, stock_quantity FROM product WHERE status='published' AND NOT hide_price AND NOT quote_only AND manage_stock AND stock_quantity >= 3 AND backorders='no' AND regular_price > 60000 ORDER BY title LIMIT 1")).rows[0]

  const login = await call('POST', '/admin/session', { body: { email: adminEmail, password: adminPass } })
  const A = { cookie: login.cookie, csrf: login.json.csrf }
  ok(login.status === 200, 'el admin entra')

  // payments: one active method, test and production credentials apart
  ok((await call('PUT', '/admin/settings/payments', { ...A, body: { active: 'payu', mode: 'test' } })).status === 400, 'no se activa PayU sin credenciales')
  ok((await call('PUT', '/admin/settings/payments/wompi/test', { ...A, body: { config: { publicKey: 'pub_prod_x' }, secrets: {} } })).status === 400, 'Wompi rechaza una llave de producción en pruebas')
  const payu = await call('PUT', '/admin/settings/payments/payu/test', { ...A, body: { config: { merchantId: '508029', accountId: '512321' }, secrets: { apiKey: PAYU_KEY } } })
  ok(payu.status === 200 && !payu.text.includes(PAYU_KEY) && payu.json.gateways.find(g => g.code === 'payu').test.complete, 'PayU guarda sus credenciales de pruebas sin devolver la llave')
  ok((await call('PUT', '/admin/settings/payments', { ...A, body: { active: 'payu', mode: 'live' } })).status === 400, 'no pasa a producción sin credenciales de producción')
  const chosen = await call('PUT', '/admin/settings/payments', { ...A, body: { active: 'payu', mode: 'test' } })
  ok(chosen.status === 200 && chosen.json.ready, 'PayU queda activo en modo pruebas')
  const options = await call('GET', '/public/checkout/options')
  ok(options.json.payment && options.json.payment.code === 'payu' && options.json.payment.test, 'el checkout ofrece un solo medio, en pruebas')
  await call('PUT', '/admin/settings/conversations', { ...A, body: { reviews: true, questions: true, manualModeration: true, buyersOnly: false, customerReplies: false } })

  // shopper account
  const reg = await call('POST', '/shop/session/register', { body: { name: 'Prueba Automática', email: shopperEmail, password: 'clave-de-prueba-' + tag } })
  ok(reg.status === 200 && reg.cookie.includes('arisma_cliente='), 'se crea la cuenta de cliente')
  let S = { cookie: reg.cookie, csrf: reg.json.csrf }
  ok((await call('POST', '/shop/account/verification', S)).status === 200, 'se pide el enlace para confirmar el correo')
  const verify = await outboxLink(A, 'verificar_correo', '/cuenta/verificar')
  ok(verify && (await call('POST', '/shop/session/verify', { body: { token: verify } })).status === 200, 'el enlace de la bandeja confirma el correo')
  ok((await call('POST', '/shop/session/verify', { body: { token: verify } })).status === 400, 'el enlace sirve una sola vez')
  ok((await call('GET', '/shop/session', S)).json.shopper.emailVerified === true, 'la cuenta queda verificada')
  ok((await call('PUT', '/shop/account/name', { ...S, body: { name: 'Prueba Renombrada' } })).json.name === 'Prueba Renombrada', 'el cliente cambia su nombre')
  ok((await call('PUT', '/shop/account/name', { cookie: S.cookie, body: { name: 'Sin token' } })).status === 401, 'cambiar datos exige el token CSRF')
  ok((await call('POST', '/shop/session/reset-request', { body: { email: 'nadie-' + tag + '@example.invalid' } })).status === 200, 'pedir recuperación de un correo sin cuenta responde igual')
  ok((await call('POST', '/shop/session/reset-request', { body: { email: shopperEmail } })).status === 200, 'se pide recuperar la contraseña')
  const reset = await outboxLink(A, 'recuperar_clave', '/cuenta/restablecer')
  ok(reset && (await call('POST', '/shop/session/reset', { body: { token: reset, password: 'otra-clave-' + tag } })).status === 200, 'se elige una contraseña nueva')
  ok((await call('GET', '/shop/session', S)).status === 401, 'recuperar la contraseña cierra las sesiones abiertas')
  ok((await call('POST', '/shop/session', { body: { email: shopperEmail, password: 'clave-de-prueba-' + tag } })).status === 401, 'la contraseña vieja ya no entra')
  const relog = await call('POST', '/shop/session', { body: { email: shopperEmail, password: 'otra-clave-' + tag } })
  ok(relog.status === 200, 'la contraseña nueva entra')
  S = { cookie: relog.cookie, csrf: relog.json.csrf }

  // reviews
  const review = await call('POST', `/shop/products/${product.id}/posts`, { ...S, body: { kind: 'review', rating: 5, body: 'Muy buen producto, llegó rápido.' } })
  ok(review.status === 201 && review.json.status === 'pending', 'la opinión espera aprobación')
  ok((await call('PUT', `/admin/posts/${review.json.id}/status`, { ...A, body: { status: 'published' } })).status === 200, 'el admin la aprueba')
  ok((await call('GET', `/public/products/${product.id}/posts?tipo=review`)).json.summary.count >= 1, 'la opinión aprobada se ve en la tienda')

  // coupon and checkout
  const lines = [{ productId: product.id, quantity: 1 }, ...(tracked ? [{ productId: tracked.id, quantity: 2 }] : [])]
  const bad = await call('POST', '/public/checkout/quote', { body: { lines, delivery: 'local', coupon: 'NOEXISTE' } })
  ok(bad.json.couponError === 'Ese cupón no existe' && bad.json.cart.discount === 0, 'un cupón inexistente se explica y no descuenta')
  const quote = await call('POST', '/public/checkout/quote', { body: { lines, delivery: 'local', coupon: couponCode.toLowerCase(), email: shopperEmail } })
  const cart = quote.json.cart
  ok(cart.coupon === couponCode && Math.abs(cart.discount - Math.round(cart.goods * 0.1)) <= cart.lines.length, 'el cupón descuenta el 10 %')
  // buying needs an account and a saved address (Mercado Libre style address book)
  const contact = { firstName: 'Prueba', lastName: 'Automática', phone: '3001234567', documentType: 'CC', documentNumber: '1020304050', company: '' }
  ok((await call('POST', '/public/checkout/orders', { body: { lines, contact, pickup: true, acceptsTerms: true } })).status === 401, 'sin cuenta no se puede comprar')
  const newAddress = { label: 'trabajo', recipient: 'Ana Recibe Prueba', phone: '3109998877', state: 'CO-DC', city: 'Bogotá', neighborhood: 'Chapinero', street: 'Calle 1 # 2-3', detail: 'Oficina 402', instructions: 'Dejar en recepción', makeDefault: false }
  ok((await call('POST', '/shop/account/addresses', { cookie: S.cookie, body: newAddress })).status === 401, 'guardar una dirección exige el token CSRF')
  ok((await call('POST', '/shop/account/addresses', { ...S, body: { ...newAddress, state: 'Bogotá' } })).status === 400, 'una dirección sin departamento válido se rechaza')
  const saved1 = await call('POST', '/shop/account/addresses', { ...S, body: newAddress })
  ok(saved1.status === 201 && saved1.json.isDefault, 'se guarda la primera dirección y queda como predeterminada')
  const saved2 = await call('POST', '/shop/account/addresses', { ...S, body: { ...newAddress, label: 'casa', street: 'Carrera 7 # 70-10', detail: '', makeDefault: true } })
  ok(saved2.status === 201 && saved2.json.isDefault, 'una segunda dirección puede quedar como predeterminada')
  const book = (await call('GET', '/shop/account/addresses', S)).json
  ok(book.length === 2 && book[0].id === saved2.json.id && !book.find(a => a.id === saved1.json.id).isDefault, 'la libreta muestra la predeterminada primero')
  ok((await call('PUT', `/shop/account/addresses/${saved1.json.id}`, { ...S, body: { ...newAddress, detail: 'Oficina 403' } })).json.detail === 'Oficina 403', 'se edita una dirección')
  ok((await call('POST', '/public/checkout/orders', { cookie: S.cookie, body: { lines, contact, pickup: false, addressId: crypto.randomUUID(), acceptsTerms: true } })).status === 404, 'no se compra con una dirección que no es de la cuenta')
  ok((await call('GET', '/public/places/cities?departamento=CO-ANT')).json.length === 125, 'el departamento trae sus 125 municipios oficiales')
  ok((await call('POST', '/shop/account/addresses', { ...S, body: { ...newAddress, city: 'Medellín' } })).status === 400, 'un municipio de otro departamento se rechaza')
  ok(saved1.json.city === 'Bogotá, D. C.', 'el municipio queda con su nombre oficial')
  const placed = await call('POST', '/public/checkout/orders', { cookie: S.cookie, body: { lines, contact, pickup: false, addressId: saved1.json.id, note: '', coupon: couponCode, acceptsTerms: true } })
  ok(placed.status === 201 && placed.json.test, 'se crea el pedido de prueba ' + (placed.json && placed.json.number))
  orders.push(placed.json.number)
  const shipTo = (await db.query('SELECT shipping, billing FROM sales_order WHERE number=$1', [placed.json.number])).rows[0]
  ok(shipTo.shipping.neighborhood === 'Chapinero' && shipTo.shipping.instructions === 'Dejar en recepción' && shipTo.shipping.address_2 === 'Oficina 403' && shipTo.shipping.first_name === 'Ana', 'el pedido lleva barrio, indicaciones y quién recibe')
  ok(shipTo.billing.email === shopperEmail && shipTo.billing.id === '1020304050', 'el pedido lleva el correo de la cuenta y el documento')
  const profile = (await call('GET', '/shop/account/profile', S)).json
  ok(profile.phone === '3001234567' && profile.documentNumber === '1020304050', 'los datos del comprador quedan guardados para la próxima')
  const row = (await db.query('SELECT id, status, test, subtotal, discount_total, tax_total, shipping_total, total FROM sales_order WHERE number=$1', [placed.json.number])).rows[0]
  ok(row.test && Math.abs(Number(row.subtotal) - Number(row.discount_total) + Number(row.tax_total) + Number(row.shipping_total) - Number(row.total)) < 0.02, 'los totales del pedido cuadran con el descuento')
  ok((await db.query('SELECT code FROM order_discount WHERE order_id=$1', [row.id])).rows[0]?.code === couponCode, 'el cupón queda en el pedido')
  if (tracked) ok((await db.query('SELECT stock_quantity FROM product WHERE id=$1', [tracked.id])).rows[0].stock_quantity === tracked.stock_quantity - 2, 'el pedido aparta las unidades')
  ok((await call('GET', '/admin/mail/outbox?limit=10', A)).json.items.some(i => i.kind === 'pedido_recibido' && i.subject.includes(placed.json.number)), 'se escribe el correo de pedido recibido')

  // PayU: the form is signed, a forged return is ignored, a signed one pays the order once
  const form = await call('POST', '/public/payments/start', { body: { number: placed.json.number, key: placed.json.key } })
  const f = form.json.fields
  ok(form.json.url.startsWith('https://sandbox.checkout.payulatam.com/') && f.signature === sha(`${PAYU_KEY}~508029~${f.referenceCode}~${f.amount}~COP`) && f.test === '1', 'PayU recibe el formulario firmado de pruebas')
  const params = (state, signature) => ({ merchantId: '508029', referenceCode: f.referenceCode, TX_VALUE: f.amount + '.00', currency: 'COP', transactionState: state, signature, transactionId: 'smoke-' + tag })
  const forged = await call('POST', '/public/payments/return', { body: { number: placed.json.number, key: placed.json.key, params: params('4', md5('falsa')) } })
  ok(forged.json.status !== 'approved', 'un regreso con firma falsa no paga el pedido')
  const signed = params('4', md5(`${PAYU_KEY}~508029~${f.referenceCode}~${f.amount}.0~COP~4`))
  ok((await call('POST', '/public/payments/return', { body: { number: placed.json.number, key: placed.json.key, params: signed } })).json.status === 'approved', 'el regreso firmado aprueba el pago')
  ok((await call('POST', '/public/payments/payu/webhook', { form: { merchant_id: '508029', reference_sale: f.referenceCode, value: f.amount + '.00', currency: 'COP', state_pol: '4', sign: md5(`${PAYU_KEY}~508029~${f.referenceCode}~${f.amount}.0~COP~4`), transaction_id: 'smoke-' + tag } })).status === 200, 'la confirmación repetida se acepta')
  const paid = (await db.query('SELECT o.status, (SELECT count(*) FROM payment_transaction t WHERE t.order_id=o.id) AS n FROM sales_order o WHERE number=$1', [placed.json.number])).rows[0]
  ok(paid.status === 'processing' && Number(paid.n) === 1, 'el pedido queda pagado una sola vez')

  // "Mis pedidos"
  const mine = await call('GET', '/shop/orders', S)
  ok(mine.json.some(o => o.number === placed.json.number), 'el pedido aparece en Mis pedidos')
  ok((await call('GET', `/shop/orders/${placed.json.number}`, S)).json.status === 'processing', 'el cliente lo abre desde su cuenta sin la clave')
  ok((await call('GET', `/shop/orders/${placed.json.number}`)).status === 401, 'sin sesión no se abre desde la cuenta')

  // transfer registered by hand
  await call('PUT', '/admin/settings/payments/manual/live', { ...A, body: { config: { instructions: 'Transfiere a la cuenta que te enviamos por WhatsApp.' }, secrets: {} } })
  ok((await call('PUT', '/admin/settings/payments', { ...A, body: { active: 'manual', mode: 'test' } })).status === 200, 'se activa la transferencia')
  const placed2 = await call('POST', '/public/checkout/orders', { cookie: S.cookie, body: { lines: [{ productId: product.id, quantity: 1 }], contact, pickup: true, acceptsTerms: true } })
  orders.push(placed2.json.number)
  ok(placed2.status === 201 && !placed2.json.test, 'un pedido por transferencia no es de prueba')
  const view = await call('GET', `/public/orders/${placed2.json.number}?clave=${placed2.json.key}`)
  ok(view.json.instructions.includes('WhatsApp') && !view.json.canPay, 'el pedido muestra las instrucciones de transferencia')
  const order2 = (await db.query('SELECT id FROM sales_order WHERE number=$1', [placed2.json.number])).rows[0].id
  ok((await call('POST', `/admin/orders/${order2}/payment`, { ...A, body: { reference: '' } })).status === 400, 'registrar un pago exige la referencia')
  ok((await call('POST', `/admin/orders/${order2}/payment`, { ...A, body: { reference: 'TRF-' + tag } })).status === 200, 'el admin registra el pago de la transferencia')
  ok((await db.query('SELECT status FROM sales_order WHERE id=$1', [order2])).rows[0].status === 'processing', 'el pedido queda pagado')
  ok((await call('POST', `/admin/orders/${order2}/payment`, { ...A, body: { reference: 'TRF-' + tag } })).status === 409, 'no se registra dos veces')

  // invoice: the store attaches the PDF of its billing program and sends it; then the order is finished
  const upload = (bytes, number) => fetch(`${api}/admin/orders/${order2}/invoice?numero=${encodeURIComponent(number)}`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream', cookie: A.cookie, 'X-CSRF-Token': A.csrf }, body: bytes })
  ok((await call('POST', `/admin/orders/${order2}/shipment/status`, { ...A, body: { status: 'delivered', recipientName: 'Prueba' } })).status === 200, 'el pedido se entrega')
  ok((await call('GET', `/admin/orders/${order2}`, A)).json.stage === 'to_invoice', 'entregado y sin factura queda «Por facturar»')
  ok((await call('GET', `/public/orders/${placed2.json.number}?clave=${placed2.json.key}`)).json.stage === 'delivered', 'el cliente lo ve entregado, no «Por facturar»')
  ok((await upload(Buffer.from('<html>no soy un pdf</html>'), 'FV 1')).status === 400, 'un archivo que no es PDF se rechaza')
  const pdf = Buffer.from(['%PDF-1.4', '1 0 obj << /Type /Catalog >> endobj', 'trailer << /Root 1 0 R >>', '%%EOF', ''].join(String.fromCharCode(10)))
  const up = await upload(pdf, 'FV ' + tag); const inv = await up.json()
  ok(up.status === 201 && inv.status === 'uploaded' && inv.link && inv.link.includes('/factura/'), 'se adjunta el PDF de la factura')
  const token = inv.link.split('/factura/')[1]
  const dl = await fetch(`${api}/public/invoices/${token}`)
  ok(dl.status === 200 && Buffer.from(await dl.arrayBuffer()).equals(pdf), 'el enlace descarga el mismo PDF')
  ok((await fetch(`${api}/public/invoices/${token.slice(0, -2)}xx`)).status === 404, 'un enlace inventado no descarga nada')
  ok((await call('GET', `/admin/orders/${order2}`, A)).json.stage === 'to_invoice', 'adjuntarla no la envía')
  const wa = await call('POST', `/admin/orders/${order2}/invoice/whatsapp`, A)
  ok(wa.status === 200 && wa.json.status === 'sent' && wa.json.channels.includes('whatsapp'), 'se marca enviada por WhatsApp')
  const done = (await call('GET', `/admin/orders/${order2}`, A)).json
  ok(done.stage === 'delivered' && done.invoice.status === 'sent', 'con la factura enviada el pedido queda finalizado')
  ok(done.history.some(h => (h.note || '').includes('enviada por WhatsApp')), 'el envío queda en el historial')
  const shopperView = (await call('GET', `/public/orders/${placed2.json.number}?clave=${placed2.json.key}`)).json
  ok(shopperView && shopperView.invoiceToken === token && shopperView.stage === 'delivered', 'el cliente ve el pedido entregado y su factura')
  ok((await call('POST', `/admin/orders/${order2}/invoice/not-needed`, A)).status === 400, 'una factura enviada no pasa a «no requiere»')
  // by email, with the PDF attached, through a local SMTP sink
  ok((await call('POST', `/admin/orders/${order2}/invoice/email`, { ...A, body: { to: shopperEmail } })).status === 400 || saved.mail, 'sin correo configurado se explica qué falta')
  const sink = await smtpSink()
  try {
    ok((await call('PUT', '/admin/settings/mail', { ...A, body: { host: '127.0.0.1', port: sink.port, security: 'NONE', username: '', password: '', fromAddress: 'pedidos@example.invalid', fromName: 'Prueba', storeInbox: '' } })).status === 200, 'se apunta el correo a un servidor de prueba')
    const mailed = await call('POST', `/admin/orders/${order2}/invoice/email`, { ...A, body: { to: shopperEmail } })
    ok(mailed.status === 200 && mailed.json.channels.includes('email'), 'la factura se envía por correo')
    const raw = sink.received.find(m => m.includes(shopperEmail)) || ''
    ok(/Content-Type: application\/pdf/i.test(raw) && /Content-Disposition: attachment/i.test(raw) && raw.includes('/factura/' + token), 'el correo lleva el PDF adjunto y el enlace de descarga')
  } finally { sink.close() }
  console.log('\nTODO BIEN')
}

async function cleanup() {
  try {
    for (const number of orders.filter(Boolean)) {
      const o = (await db.query('SELECT id FROM sales_order WHERE number=$1', [number])).rows[0]
      if (!o) continue
      for (const l of (await db.query('SELECT product_id, stock_reduced FROM order_line WHERE order_id=$1 AND stock_reduced>0', [o.id])).rows) await db.query('UPDATE product SET stock_quantity=stock_quantity+$1 WHERE id=$2', [l.stock_reduced, l.product_id])
      await db.query('DELETE FROM inventory_adjustment WHERE order_line_id IN (SELECT id FROM order_line WHERE order_id=$1)', [o.id])
      await db.query('DELETE FROM sales_order WHERE id=$1', [o.id])
    }
    await db.query("UPDATE product SET stock_status='instock' WHERE manage_stock AND stock_quantity>0 AND stock_status='outofstock'")
    const acc = (await db.query('SELECT id, customer_id FROM customer_account WHERE email=$1', [shopperEmail])).rows[0]
    if (acc) {
      await db.query('DELETE FROM product_post WHERE account_id=$1', [acc.id])
      await db.query('DELETE FROM customer_account WHERE id=$1', [acc.id])
      await db.query('DELETE FROM customer WHERE id=$1 AND NOT EXISTS (SELECT 1 FROM sales_order WHERE customer_id=$1)', [acc.customer_id])
    }
    await db.query('DELETE FROM mail_outbox WHERE recipient=$1', [shopperEmail])
    await db.query('DELETE FROM coupon WHERE code=$1', [couponCode])
    for (const k of ['payments', 'conversations', 'mail', 'mail_secret']) { if (saved[k]) await db.query('UPDATE store_setting SET value=$2, updated_by=NULL WHERE key=$1', [k, saved[k].value]); else await db.query('DELETE FROM store_setting WHERE key=$1', [k]) }
    await db.query('DELETE FROM payment_credential')
    for (const c of saved.credentials || []) await db.query('INSERT INTO payment_credential(code,environment,public_config,secret_cipher) VALUES($1,$2,$3,$4)', [c.code, c.environment, c.public_config, c.secret_cipher])
    await db.query('DELETE FROM admin_user WHERE id=$1', [adminId])
  } catch (e) { console.error('limpieza incompleta:', e.message) }
  await db.end()
}
main().catch(e => { console.error(e.message); process.exitCode = 1 }).finally(cleanup)

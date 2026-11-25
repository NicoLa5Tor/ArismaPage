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
const orders = [], saved = {}, twins = [], versions = []
let erasable = ''
const hashPassword = (pass) => { const salt = crypto.randomBytes(16); return `pbkdf2-sha256$600000$${salt.toString('hex')}$${crypto.pbkdf2Sync(pass, salt, 600000, 32, 'sha256').toString('hex')}` }

async function call(method, path, { body, cookie, csrf, form, headers } = {}) {
  const h = { ...(headers || {}) }
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
  for (const k of ['payments', 'conversations', 'mail', 'mail_secret', 'checkout', 'legal', 'error_pages']) saved[k] = (await db.query('SELECT value FROM store_setting WHERE key=$1', [k])).rows[0]
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

  // the site: legal documents with versions, and the store's own error pages
  const legal = await call('GET', '/admin/site/legal', A)
  ok(legal.status === 200 && legal.json.map(d => d.kind).join() === 'terms,privacy,returns,shipping', 'el panel lista los cuatro documentos legales')
  const shippingDoc = legal.json.find(d => d.kind === 'shipping')
  let shippingPublished = false
  if (!shippingDoc.published && shippingDoc.draft.blocks.length === 0) {
    const drafted = await call('POST', '/admin/site/legal/shipping/draft', A)
    const text = JSON.stringify(drafted.json.find(d => d.kind === 'shipping').draft)
    ok(drafted.status === 200 && text.includes('Así entregamos'), 'el borrador de envíos sale de las reglas de la tienda')
    ok((await call('POST', '/admin/site/legal/shipping/draft', A)).status === 409, 'el borrador sugerido nunca pisa lo escrito')
    ok((await call('POST', '/admin/site/legal/shipping/publish', { cookie: A.cookie })).status === 401, 'publicar exige el token CSRF')
    const pub = await call('POST', '/admin/site/legal/shipping/publish', A)
    const after = pub.json.find(d => d.kind === 'shipping')
    ok(pub.status === 200 && after.published && after.published.version === 1 && !after.changed, 'la política de envíos se publica como versión 1')
    versions.push(...(await db.query("SELECT id FROM legal_version WHERE kind='shipping'")).rows.map(r => r.id))
    ok((await call('POST', '/admin/site/legal/shipping/publish', A)).status === 409, 'sin cambios no hay versión nueva')
    const page = await call('GET', '/public/store/legal/shipping')
    ok(page.status === 200 && page.json.version === 1 && page.json.blocks.length > 0, 'la tienda muestra la versión publicada')
    ok((await call('GET', '/public/store')).json.legal.shipping === true, 'el perfil público dice que está publicada')
    shippingPublished = true
  }
  ok((await call('GET', '/public/store/legal/cookies')).status === 404, 'un documento que no existe da 404')
  ok((await call('GET', '/public/store/error-pages/not_found')).status === 404 || saved.error_pages, 'sin página propia la tienda usa la suya')
  ok((await call('PUT', '/admin/site/error-pages/not_found', { ...A, body: { enabled: true, html: '', css: '', js: '' } })).status === 400, 'una página de error activa necesita HTML')
  const errorPage = { enabled: true, html: '<h1>Uy ' + tag + '</h1>', css: 'h1{color:red}', js: 'console.log(tienda.ruta)' }
  ok((await call('PUT', '/admin/site/error-pages/not_found', { ...A, body: errorPage })).status === 200, 'la tienda guarda su página 404')
  const live = await call('GET', '/public/store/error-pages/not_found')
  ok(live.status === 200 && live.json.html.includes(tag) && live.json.js.includes('tienda.ruta'), 'la tienda sirve su página 404 con su código')
  await call('PUT', '/admin/site/error-pages/not_found', { ...A, body: { ...errorPage, enabled: false } })
  ok((await call('GET', '/public/store/error-pages/not_found')).status === 404, 'apagada, la tienda vuelve a su página')

  // shopper account
  ok((await call('POST', '/shop/session/register', { body: { name: 'Prueba Automática', email: shopperEmail, password: 'clave-de-prueba-' + tag } })).status === 400, 'sin autorizar el tratamiento de datos no se crea la cuenta')
  const reg = await call('POST', '/shop/session/register', { body: { name: 'Prueba Automática', email: shopperEmail, password: 'clave-de-prueba-' + tag, acceptsPrivacy: true } })
  ok(reg.status === 200 && reg.cookie.includes('norpress_cliente='), 'se crea la cuenta de cliente')
  let S = { cookie: reg.cookie, csrf: reg.json.csrf }
  const signedUp = (await db.query("SELECT v.kind, a.user_agent FROM legal_acceptance a JOIN legal_version v ON v.id=a.version_id WHERE a.account_id=$1 AND a.context='signup' ORDER BY v.kind", [reg.json.shopper.id])).rows
  ok(signedUp.map(r => r.kind).join() === 'privacy,terms', 'al registrarse queda la prueba de que aceptó términos y datos')
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

  // the store session and the panel session are apart, even for one person with the same email in both
  const twinId = crypto.randomUUID(), twinPass = crypto.randomBytes(24).toString('hex')
  await db.query("INSERT INTO admin_user(id,email,name,role,password_hash) VALUES($1,$2,'Smoke mismo correo','admin',$3)", [twinId, shopperEmail, hashPassword(twinPass)])
  twins.push(twinId)
  const twin = await call('POST', '/admin/session', { body: { email: shopperEmail, password: twinPass } })
  ok(twin.status === 200 && (await call('GET', '/shop/session', S)).status === 200, 'entrar al panel con el mismo correo no toca la sesión de la tienda')
  ok((await call('DELETE', '/admin/session', { cookie: twin.cookie, csrf: twin.json.csrf })).status === 200 && (await call('GET', '/shop/session', S)).status === 200, 'salir del panel no cierra la sesión de la tienda')
  const twin2 = await call('POST', '/admin/session', { body: { email: shopperEmail, password: twinPass } })
  ok((await call('GET', '/admin/session', { cookie: twin2.cookie })).status === 200 && (await call('GET', '/admin/session', A)).status === 200, 'entrar y salir de la tienda no toca las sesiones del panel')
  await call('DELETE', '/admin/session', { cookie: twin2.cookie, csrf: twin2.json.csrf })
  // a visit renews the store session: 30 days from now, in the database and in the cookie
  await db.query("UPDATE customer_session SET expires_at = now() + interval '3 days' WHERE account_id = (SELECT id FROM customer_account WHERE email=$1)", [shopperEmail])
  const visit = await call('GET', '/shop/session', S)
  const left = (await db.query("SELECT extract(epoch FROM max(expires_at) - now()) / 86400 AS days FROM customer_session WHERE account_id = (SELECT id FROM customer_account WHERE email=$1)", [shopperEmail])).rows[0].days
  ok(visit.status === 200 && visit.cookie.includes('norpress_cliente=') && Number(left) > 29, 'cada visita renueva la sesión por 30 días')

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
  const accepted = (await db.query("SELECT v.kind FROM legal_acceptance a JOIN legal_version v ON v.id=a.version_id JOIN sales_order o ON o.id=a.order_id WHERE o.number=$1 AND a.context='checkout' ORDER BY v.kind", [placed.json.number])).rows.map(r => r.kind)
  ok(accepted.includes('terms') && accepted.includes('privacy') && (!shippingPublished || accepted.includes('shipping')), 'el pedido guarda qué versión de cada política aceptó: ' + accepted.join(', '))
  ok((await call('POST', '/public/checkout/orders', { cookie: S.cookie, body: { lines, contact, pickup: true, acceptsTerms: false } })).status === 400, 'sin aceptar las políticas no se compra')
  const shipTo = (await db.query('SELECT shipping, billing FROM sales_order WHERE number=$1', [placed.json.number])).rows[0]
  ok(shipTo.shipping.neighborhood === 'Chapinero' && shipTo.shipping.instructions === 'Dejar en recepción' && shipTo.shipping.address_2 === 'Oficina 403' && shipTo.shipping.first_name === 'Ana', 'el pedido lleva barrio, indicaciones y quién recibe')
  ok(shipTo.billing.email === shopperEmail && shipTo.billing.id === '1020304050', 'el pedido lleva el correo de la cuenta y el documento')
  const profile = (await call('GET', '/shop/account/profile', S)).json
  ok(profile.phone === '3001234567' && profile.documentNumber === '1020304050', 'los datos del comprador quedan guardados para la próxima')
  const row = (await db.query('SELECT id, status, test, subtotal, discount_total, tax_total, shipping_total, total FROM sales_order WHERE number=$1', [placed.json.number])).rows[0]
  ok(row.test && Math.abs(Number(row.subtotal) - Number(row.discount_total) + Number(row.tax_total) + Number(row.shipping_total) - Number(row.total)) < 0.02, 'los totales del pedido cuadran con el descuento')
  ok((await db.query('SELECT code FROM order_discount WHERE order_id=$1', [row.id])).rows[0]?.code === couponCode, 'el cupón queda en el pedido')
  if (tracked) ok((await db.query('SELECT stock_quantity FROM product WHERE id=$1', [tracked.id])).rows[0].stock_quantity === tracked.stock_quantity, 'un pedido de prueba no aparta unidades reales')
  ok((await call('GET', '/admin/mail/outbox?limit=10', A)).json.items.some(i => i.kind === 'pedido_recibido' && i.subject.includes(placed.json.number)), 'se escribe el correo de pedido recibido')

  // PayU: the form is signed, a forged return is ignored, a signed one pays the order once
  // an order of an account is only opened signed in with it: its key link shows nothing
  ok((await call('GET', `/public/orders/${placed.json.number}?clave=${placed.json.key}`)).status === 404, 'la clave sola no abre un pedido de una cuenta')
  const form = await call('POST', `/shop/orders/${placed.json.number}/pay`, S)
  const f = form.json.fields
  ok(form.json.url.startsWith('https://sandbox.checkout.payulatam.com/') && f.signature === sha(`${PAYU_KEY}~508029~${f.referenceCode}~${f.amount}~COP`) && f.test === '1', 'PayU recibe el formulario firmado de pruebas')
  const params = (state, signature) => ({ merchantId: '508029', referenceCode: f.referenceCode, TX_VALUE: f.amount + '.00', currency: 'COP', transactionState: state, signature, transactionId: 'smoke-' + tag })
  const forged = await call('POST', `/shop/orders/${placed.json.number}/return`, { ...S, body: { params: params('4', md5('falsa')) } })
  ok(forged.json.status !== 'approved', 'un regreso con firma falsa no paga el pedido')
  const signed = params('4', md5(`${PAYU_KEY}~508029~${f.referenceCode}~${f.amount}.0~COP~4`))
  ok((await call('POST', `/shop/orders/${placed.json.number}/return`, { ...S, body: { params: signed } })).json.status === 'approved', 'el regreso firmado aprueba el pago')
  ok((await call('POST', '/public/payments/payu/webhook', { form: { merchant_id: '508029', reference_sale: f.referenceCode, value: f.amount + '.00', currency: 'COP', state_pol: '4', sign: md5(`${PAYU_KEY}~508029~${f.referenceCode}~${f.amount}.0~COP~4`), transaction_id: 'smoke-' + tag } })).status === 200, 'la confirmación repetida se acepta')
  const paid = (await db.query('SELECT o.status, (SELECT count(*) FROM payment_transaction t WHERE t.order_id=o.id) AS n FROM sales_order o WHERE number=$1', [placed.json.number])).rows[0]
  ok(paid.status === 'processing' && Number(paid.n) === 1, 'el pedido queda pagado una sola vez')

  // "Mis pedidos"
  const mine = await call('GET', '/shop/orders', S)
  ok(mine.json.some(o => o.number === placed.json.number), 'el pedido aparece en Mis pedidos')
  ok((await call('GET', `/shop/orders/${placed.json.number}`, S)).json.status === 'processing', 'el cliente lo abre desde su cuenta sin la clave')
  ok((await call('GET', `/shop/orders/${placed.json.number}`)).status === 401, 'sin sesión no se abre desde la cuenta')

  // sending with a guide: a carrier of the store's list, the shopper's link, live updates and the 17TRACK webhook
  const carriers = (await call('GET', '/admin/carriers', A)).json
  ok(Array.isArray(carriers) && carriers.some(k => k.code === 'coordinadora' && k.linkTemplate && k.linkTemplate.includes('{guia}')), 'la tienda tiene sus transportadoras con enlace')
  ok((await call('POST', `/admin/orders/${row.id}/shipment/status`, { ...A, body: { status: 'packed' } })).status === 200, 'el pedido se empaca')
  ok((await call('POST', `/admin/orders/${row.id}/shipment/status`, { ...A, body: { status: 'shipped', carrierCode: 'coordinadora', trackingCode: '12', follow: false } })).status === 400, 'un número de guía inválido se rechaza')
  // the order's page listens live (SSE), signed in, before the step happens
  const listening = new AbortController()
  const heard = (async () => {
    const r = await fetch(`${api}/shop/orders/${placed.json.number}/events`, { signal: listening.signal, headers: { accept: 'text/event-stream', cookie: S.cookie } })
    if (!r.ok) return 'status ' + r.status
    const reader = r.body.getReader(); let text = ''
    while (!text.includes('shipment')) { const { value, done } = await reader.read(); if (done) break; text += Buffer.from(value).toString() }
    return text
  })().catch(e => 'error ' + e.message)
  await new Promise(r => setTimeout(r, 800))
  const shipped = await call('POST', `/admin/orders/${row.id}/shipment/status`, { ...A, body: { status: 'shipped', carrierCode: 'coordinadora', trackingCode: ' 1234 5678 901 ', follow: false } })
  ok(shipped.status === 200 && shipped.json.carrier === 'Coordinadora' && shipped.json.trackingCode === '12345678901' && shipped.json.follow === false, 'se envía con Coordinadora, guía normalizada y solo enlace')
  ok(shipped.json.trackingUrl === 'https://coordinadora.com/rastreo/rastreo-de-guia/detalle-de-rastreo-de-guia/?guia=12345678901' && shipped.json.opensGuide === true, 'el panel ve el enlace que abre la guía')
  const seen = await Promise.race([heard, new Promise(r => setTimeout(() => r('timeout'), 6000))])
  listening.abort()
  ok(typeof seen === 'string' && seen.includes('shipment'), 'la página del pedido se entera al instante (SSE): ' + String(seen).slice(0, 60))
  const shopperOrder = (await call('GET', `/shop/orders/${placed.json.number}`, S)).json
  ok(shopperOrder.journey.map(s => s.title).join(' > ') === 'Recibimos tu pedido > Pago confirmado > Empacamos tu pedido > Salió con Coordinadora', 'el cliente ve todos los pasos de su pedido: ' + shopperOrder.journey.map(s => s.title).join(' > '))
  ok((await call('GET', '/shop/orders/news', S)).json.some(n => n.number === placed.json.number && n.step === 'Salió con Coordinadora'), 'el envío le llega como novedad en su cuenta')
  ok((await call('POST', `/shop/orders/${placed.json.number}/seen`, S)).status === 204 && !(await call('GET', '/shop/orders/news', S)).json.some(n => n.number === placed.json.number), 'al abrir el pedido la novedad queda vista')
  ok(shopperOrder.trackingUrl === shipped.json.trackingUrl && shopperOrder.opensGuide === true, 'el cliente recibe el enlace con su guía')
  ok((await db.query("SELECT count(*)::int AS n FROM shipment_tracking t JOIN shipment s ON s.id=t.shipment_id WHERE s.order_id=$1", [row.id])).rows[0].n === 0, 'solo enlace: la guía no gasta cupo de seguimiento')
  ok((await fetch(`${api}/public/tracking/17track`, { method: 'POST', headers: { sign: 'falsa', 'content-type': 'application/json' }, body: '{"event":"TRACKING_UPDATED","data":{"number":"12345678901"}}' })).status === 401, 'un aviso de 17TRACK sin firma válida se rechaza')

  // transfer registered by hand
  await call('PUT', '/admin/settings/payments/manual/live', { ...A, body: { config: { instructions: 'Transfiere a la cuenta que te enviamos por WhatsApp.' }, secrets: {} } })
  ok((await call('PUT', '/admin/settings/payments', { ...A, body: { active: 'manual', mode: 'test' } })).status === 200, 'se activa la transferencia')
  const placed2 = await call('POST', '/public/checkout/orders', { cookie: S.cookie, body: { lines: [{ productId: product.id, quantity: 1 }], contact, pickup: true, acceptsTerms: true } })
  orders.push(placed2.json.number)
  ok(placed2.status === 201 && !placed2.json.test, 'un pedido por transferencia no es de prueba')
  const view = await call('GET', `/shop/orders/${placed2.json.number}`, S)
  ok(view.json.instructions.includes('WhatsApp') && !view.json.canPay, 'el pedido muestra las instrucciones de transferencia')
  const order2 = (await db.query('SELECT id FROM sales_order WHERE number=$1', [placed2.json.number])).rows[0].id
  ok((await call('POST', `/admin/orders/${order2}/payment`, { ...A, body: { reference: '' } })).status === 400, 'registrar un pago exige la referencia')
  ok((await call('POST', `/admin/orders/${order2}/payment`, { ...A, body: { reference: 'TRF-' + tag } })).status === 200, 'el admin registra el pago de la transferencia')
  ok((await db.query('SELECT status FROM sales_order WHERE id=$1', [order2])).rows[0].status === 'processing', 'el pedido queda pagado')
  ok((await call('POST', `/admin/orders/${order2}/payment`, { ...A, body: { reference: 'TRF-' + tag } })).status === 409, 'no se registra dos veces')

  // the same try sent twice (a double click, a retry after a lost answer) makes one order
  if (tracked) {
    const attempt = { cookie: S.cookie, headers: { 'Idempotency-Key': 'smoke-' + tag }, body: { lines: [{ productId: tracked.id, quantity: 1 }], contact, pickup: true, acceptsTerms: true } }
    const first = await call('POST', '/public/checkout/orders', attempt)
    const again = await call('POST', '/public/checkout/orders', attempt)
    orders.push(first.json.number)
    ok(first.status === 201 && again.status === 201 && again.json.number === first.json.number, 'el mismo intento enviado dos veces da un solo pedido')
    ok((await db.query('SELECT count(*)::int AS n FROM sales_order WHERE request_key=$1', ['smoke-' + tag])).rows[0].n === 1, 'en la base queda un solo pedido')
    const stockNow = () => db.query('SELECT stock_quantity FROM product WHERE id=$1', [tracked.id]).then(r => r.rows[0].stock_quantity)
    ok(await stockNow() === tracked.stock_quantity - 1, 'un pedido real aparta su unidad')

    // its time to pay ran out (cancelled, the unit back on the shelf) and the transfer arrives afterwards
    const order3 = (await db.query('SELECT id FROM sales_order WHERE number=$1', [first.json.number])).rows[0].id
    ok((await call('POST', `/admin/orders/${order3}/status`, { ...A, body: { status: 'cancelled', note: 'Venció el plazo para pagar' } })).status === 200, 'el pedido se cancela sin pagar')
    await db.query('UPDATE sales_order SET unpaid_expired_at=now() WHERE id=$1', [order3])
    ok(await stockNow() === tracked.stock_quantity, 'la unidad vuelve a la tienda')
    ok((await call('POST', `/admin/orders/${order3}/revive`, A)).status === 409, 'sin pago no se reactiva')
    ok((await call('GET', `/admin/orders/${order3}`, A)).json.unpaidExpiredAt, 'el panel sabe que se canceló por falta de pago')
    const late = await call('POST', `/admin/orders/${order3}/payment`, { ...A, body: { reference: 'TRF-TARDE-' + tag } })
    ok(late.status === 200, 'el pago que llegó tarde se registra: ' + late.status + ' ' + (late.json && late.json.error || ''))
    const back = (await call('GET', `/admin/orders/${order3}`, A)).json
    ok(back.status === 'processing' && !back.unpaidExpiredAt, 'el pedido vuelve a quedar pagado')
    ok(await stockNow() === tracked.stock_quantity - 1, 'y aparta de nuevo su unidad')
    ok((await call('GET', `/admin/orders/${order3}/shipment`, A)).json.status === 'pending', 'su envío vuelve a estar por preparar')
    ok((await call('GET', '/admin/mail/outbox?limit=10', A)).json.items.some(i => i.kind === 'pago_aprobado' && i.subject.includes(first.json.number)), 'el cliente recibe la confirmación del pago')
    // the team marks it ready to pick up: the shopper is told
    ok((await call('POST', `/admin/orders/${order3}/shipment/status`, { ...A, body: { status: 'packed' } })).status === 200, 'se marca listo para recoger')
    ok((await call('GET', '/admin/mail/outbox?limit=10', A)).json.items.some(i => i.kind === 'listo_para_recoger' && i.subject.includes(first.json.number)), 'el cliente recibe «listo para recoger»')
  }

  // invoice: the store attaches the PDF of its billing program and sends it; then the order is finished
  const upload = (bytes, number) => fetch(`${api}/admin/orders/${order2}/invoice?numero=${encodeURIComponent(number)}`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream', cookie: A.cookie, 'X-CSRF-Token': A.csrf }, body: bytes })
  ok((await call('POST', `/admin/orders/${order2}/shipment/status`, { ...A, body: { status: 'delivered', recipientName: 'Prueba' } })).status === 200, 'el pedido se entrega')
  ok((await call('GET', `/admin/orders/${order2}`, A)).json.stage === 'to_invoice', 'entregado y sin factura queda «Por facturar»')
  ok((await call('GET', `/shop/orders/${placed2.json.number}`, S)).json.stage === 'delivered', 'el cliente lo ve entregado, no «Por facturar»')
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
  const shopperView = (await call('GET', `/shop/orders/${placed2.json.number}`, S)).json
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

  // cancelling: the shopper cancels on their own while the order has not left, and the money goes back
  const account = { bank: 'Bancolombia', accountType: 'ahorros', number: '55501234987', holder: 'Prueba Automática', documentType: 'CC', document: '1020304050' }
  const place = async () => {
    const r = await call('POST', '/public/checkout/orders', { cookie: S.cookie, body: { lines: [{ productId: product.id, quantity: 1 }], contact, pickup: true, acceptsTerms: true } })
    orders.push(r.json.number)
    const row = (await db.query('SELECT id, total FROM sales_order WHERE number=$1', [r.json.number])).rows[0]
    return { n: r.json.number, id: row.id, total: Number(row.total) }
  }
  // unpaid: cancelled, nothing to give back
  const o3 = await place()
  // the store can turn it off: then only the store cancels, from the panel
  ok((await call('PUT', '/admin/settings/checkout', { ...A, body: { unpaidHours: 48, shopperCancels: false } })).json.shopperCancels === false, 'la tienda apaga la cancelación por el cliente')
  ok((await call('GET', `/shop/orders/${o3.n}`, S)).json.canCancel === false && (await call('POST', `/shop/orders/${o3.n}/cancel`, { ...S, body: { reason: 'Me equivoqué de producto' } })).status === 409, 'apagada, el cliente no puede cancelar')
  ok((await call('PUT', '/admin/settings/checkout', { ...A, body: { unpaidHours: 48, shopperCancels: true } })).json.shopperCancels === true, 'la tienda la vuelve a encender')
  const p3 = await call('GET', `/shop/orders/${o3.n}/cancel`, S)
  ok(p3.status === 200 && p3.json.canCancel && Number(p3.json.refund) === 0 && p3.json.route === 'none', 'sin pagar: se puede cancelar y no hay nada que devolver')
  ok((await call('POST', `/shop/orders/${o3.n}/cancel`, { ...S, body: { reason: 'no' } })).status === 400, 'cancelar exige un motivo')
  ok((await call('POST', `/shop/orders/${o3.n}/cancel`, { cookie: S.cookie, body: { reason: 'Me equivoqué de producto' } })).status === 401, 'cancelar exige el token CSRF')
  const c3 = await call('POST', `/shop/orders/${o3.n}/cancel`, { ...S, body: { reason: 'Me equivoqué de producto' } })
  ok(c3.status === 200 && c3.json.status === 'cancelled' && c3.json.canCancel === false && !c3.json.refund, 'el cliente cancela su pedido sin pagar')
  ok((await call('POST', `/shop/orders/${o3.n}/cancel`, { ...S, body: { reason: 'Otra vez' } })).status === 409, 'un pedido cancelado no se cancela dos veces')

  // paid outside a gateway: the money goes back by transfer, to the account the shopper gives
  const o4 = await place()
  ok((await call('POST', `/admin/orders/${o4.id}/status`, { ...A, body: { status: 'processing', note: 'Pago confirmado' } })).status === 200, 'el pedido se marca pagado')
  const p4 = await call('GET', `/shop/orders/${o4.n}/cancel`, S)
  ok(p4.json.canCancel && Number(p4.json.refund) === o4.total && p4.json.route === 'transfer' && p4.json.needsAccount, 'pagado por fuera: se devuelve todo por transferencia y pide la cuenta')
  ok((await call('POST', `/shop/orders/${o4.n}/cancel`, { ...S, body: { reason: 'Ya no lo necesito' } })).status === 400, 'sin cuenta no se cancela un pedido que se devuelve por transferencia')
  ok((await call('POST', `/shop/orders/${o4.n}/cancel`, { ...S, body: { reason: 'Ya no lo necesito', account: { ...account, number: '12' } } })).status === 400, 'una cuenta inválida se rechaza')
  ok((await db.query("SELECT status FROM sales_order WHERE id=$1", [o4.id])).rows[0].status === 'processing', 'si algo falla el pedido sigue igual')
  const c4 = await call('POST', `/shop/orders/${o4.n}/cancel`, { ...S, body: { reason: 'Ya no lo necesito', account } })
  ok(c4.status === 200 && c4.json.status === 'cancelled' && c4.json.refund.status === 'to_transfer' && c4.json.refund.hasAccount === true, 'el cliente cancela y su reembolso espera la transferencia')
  const sealed = (await db.query('SELECT sealed FROM refund_payout WHERE order_id=$1', [o4.id])).rows[0].sealed
  ok(!sealed.includes('55501234987') && !sealed.includes('1020304050'), 'la cuenta se guarda cifrada')
  const today = new Date().toISOString().slice(0, 10)
  ok((await call('GET', `/admin/reports/summary?from=${today}&to=${today}`, A)).json.queue.refundsToTransfer >= 1, 'el panel cuenta los reembolsos por transferir')
  ok((await call('GET', `/admin/orders?stage=refund_pending&historial=true&q=${o4.n}`, A)).json.items.some(i => i.number === o4.n), 'el panel lista los reembolsos pendientes')
  const d4 = (await call('GET', `/admin/orders/${o4.id}`, A)).json
  ok(d4.refundAccount === true && !JSON.stringify(d4).includes('55501234987'), 'el detalle del pedido no muestra la cuenta, solo que existe')
  const opened = await call('POST', `/admin/orders/${o4.id}/refund/account`, A)
  ok(opened.status === 200 && opened.json.number === '55501234987' && opened.json.holder === 'Prueba Automática', 'el panel abre la cuenta a propósito')
  ok((await db.query("SELECT count(*)::int AS n FROM order_status_history WHERE order_id=$1 AND note LIKE 'Se vieron los datos%'", [o4.id])).rows[0].n === 1, 'abrir la cuenta queda en el historial')
  ok((await call('POST', `/admin/orders/${o4.id}/refund/transferred`, { ...A, body: { reference: '' } })).status === 400, 'registrar la transferencia exige la referencia')
  const t4 = await call('POST', `/admin/orders/${o4.id}/refund/transferred`, { ...A, body: { reference: 'TRF-' + tag } })
  ok(t4.status === 200 && t4.json.status === 'refunded', 'al transferir todo, el pedido queda reembolsado')
  ok((await db.query('SELECT count(*)::int AS n FROM refund_payout WHERE order_id=$1', [o4.id])).rows[0].n === 0, 'la cuenta se borra al terminar el reembolso')
  const steps4 = (await call('GET', `/shop/orders/${o4.n}`, S)).json.journey.map(st => st.title)
  ok(steps4.includes('Estamos devolviendo tu dinero') && steps4.includes('Te devolvimos dinero') && steps4.at(-1) === 'Te devolvimos todo el dinero', 'el cliente ve su reembolso paso a paso: ' + steps4.join(' > '))
  const mails = (await call('GET', '/admin/mail/outbox?limit=50', A)).json.items.filter(i => i.recipient === shopperEmail)
  ok(mails.some(i => i.kind === 'pedido_cancelado' && i.subject.includes(o4.n)) && mails.some(i => i.kind === 'reembolso_hecho' && i.subject.includes(o4.n)), 'llegan los correos de cancelación y de reembolso')
  ok(!mails.some(i => (i.bodyHtml || '').includes('55501234987')), 'ningún correo lleva la cuenta')

  // the store cancels a paid order: the refund waits for the shopper's account, which they give in their order
  const o5 = await place()
  await call('POST', `/admin/orders/${o5.id}/status`, { ...A, body: { status: 'processing', note: 'Pago confirmado' } })
  const c5 = await call('POST', `/admin/orders/${o5.id}/status`, { ...A, body: { status: 'cancelled', note: 'Sin existencias' } })
  ok(c5.status === 200 && c5.json.status === 'cancelled' && c5.json.refunds.some(r => r.status === 'to_transfer' && r.requestedBy === 'store'), 'la tienda cancela un pedido pagado y arranca el reembolso')
  ok((await call('GET', `/shop/orders/${o5.n}`, S)).json.refund.hasAccount === false, 'el cliente ve que falta su cuenta')
  ok((await call('POST', `/shop/orders/${o5.n}/refund-account`, { ...S, body: account })).json.refund.hasAccount === true, 'el cliente da su cuenta desde su pedido')
  ok((await call('POST', `/shop/orders/${o3.n}/refund-account`, { ...S, body: account })).status === 409, 'no se da cuenta a un pedido sin reembolso')
  await call('POST', `/admin/orders/${o5.id}/refund/transferred`, { ...A, body: { reference: 'TRF5-' + tag } })

  // an order that already left is not cancelled, by the shopper nor by the store
  const gone = (await call('POST', `/shop/orders/${placed.json.number}/cancel`, { ...S, body: { reason: 'Ya no lo quiero', account } }))
  ok(gone.status === 409, 'un pedido que ya salió no lo cancela el cliente')
  ok((await call('GET', `/shop/orders/${placed.json.number}/cancel`, S)).json.canCancel === false, 'ni se le ofrece')
  ok((await call('POST', `/admin/orders/${row.id}/status`, { ...A, body: { status: 'cancelled' } })).status === 409, 'ni la tienda lo cancela desde el panel')
  ok((await call('POST', `/admin/orders/${o4.id}/status`, { ...A, body: { status: 'refunded' } })).status === 400, 'reembolsado no se marca a mano')
  // the shopper's data (Ley 1581): a copy of it, and erasing the account
  const exported = await call('GET', '/shop/account/export', S)
  ok(exported.status === 200 && exported.json.account.email === shopperEmail && exported.json.orders.length >= 1 && exported.json.acceptances.length >= 2, 'el cliente descarga sus datos, con sus pedidos y lo que aceptó')
  const erasePending = await call('POST', '/shop/account/erase', { ...S, body: { password: 'otra-clave-' + tag } })
  ok(erasePending.status === 409 && erasePending.json.error.includes('#'), 'con un pedido en camino la cuenta no se elimina: ' + (erasePending.json && erasePending.json.error))
  const otherEmail = 'smoke-borrar-' + tag + '@tienda.test'
  erasable = otherEmail
  const other = await call('POST', '/shop/session/register', { body: { name: 'Cuenta Para Borrar', email: otherEmail, password: 'clave-de-prueba-' + tag, acceptsPrivacy: true } })
  const O = { cookie: other.cookie, csrf: other.json.csrf }
  await call('POST', '/shop/account/addresses', { ...O, body: newAddress })
  ok((await call('POST', '/shop/account/erase', { ...O, body: { password: 'otra' } })).status === 401, 'eliminar la cuenta exige la contraseña')
  ok((await call('POST', '/shop/account/erase', { cookie: O.cookie, body: { password: 'clave-de-prueba-' + tag } })).status === 401, 'eliminar la cuenta exige el token CSRF')
  const erased = await call('POST', '/shop/account/erase', { ...O, body: { password: 'clave-de-prueba-' + tag } })
  ok(erased.status === 200, 'el cliente elimina su cuenta')
  ok((await db.query('SELECT count(*)::int AS n FROM customer_account WHERE lower(email)=lower($1)', [otherEmail])).rows[0].n === 0, 'la cuenta ya no existe')
  ok((await db.query('SELECT count(*)::int AS n FROM customer WHERE lower(email)=lower($1)', [otherEmail])).rows[0].n === 0, 'su correo ya no está en los clientes')
  ok((await call('GET', '/shop/session', O)).status === 401, 'su sesión se cerró')
  console.log('\nTODO BIEN')
}

async function cleanup() {
  try {
    for (const number of orders.filter(Boolean)) {
      const o = (await db.query('SELECT id FROM sales_order WHERE number=$1', [number])).rows[0]
      if (!o) continue
      for (const l of (await db.query('SELECT product_id, stock_reduced FROM order_line WHERE order_id=$1 AND stock_reduced>0', [o.id])).rows) await db.query('UPDATE product SET stock_quantity=stock_quantity+$1 WHERE id=$2', [l.stock_reduced, l.product_id])
      await db.query('DELETE FROM inventory_adjustment WHERE order_line_id IN (SELECT id FROM order_line WHERE order_id=$1)', [o.id])
      await db.query('DELETE FROM legal_acceptance WHERE order_id=$1', [o.id])
      await db.query('DELETE FROM sales_order WHERE id=$1', [o.id])
    }
    await db.query("UPDATE product SET stock_status='instock' WHERE manage_stock AND stock_quantity>0 AND stock_status='outofstock'")
    const acc = (await db.query('SELECT id, customer_id FROM customer_account WHERE email=$1', [shopperEmail])).rows[0]
    if (acc) {
      await db.query('DELETE FROM product_post WHERE account_id=$1', [acc.id])
      await db.query('DELETE FROM legal_acceptance WHERE account_id=$1', [acc.id])
      await db.query('DELETE FROM customer_account WHERE id=$1', [acc.id])
      await db.query('DELETE FROM customer WHERE id=$1 AND NOT EXISTS (SELECT 1 FROM sales_order WHERE customer_id=$1)', [acc.customer_id])
    }
    await db.query('DELETE FROM mail_outbox WHERE recipient=$1 OR recipient=$2', [shopperEmail, erasable])
    await db.query("DELETE FROM customer WHERE first_name='Cuenta eliminada' AND email IS NULL AND NOT EXISTS (SELECT 1 FROM sales_order WHERE customer_id=customer.id) AND NOT EXISTS (SELECT 1 FROM customer_account WHERE customer_id=customer.id) AND created_at > now() - interval '1 hour'")
    if (versions.length) { await db.query('DELETE FROM legal_acceptance WHERE version_id = ANY($1::uuid[])', [versions]); await db.query('DELETE FROM legal_version WHERE id = ANY($1::uuid[])', [versions]) }
    await db.query('DELETE FROM coupon WHERE code=$1', [couponCode])
    for (const k of ['payments', 'conversations', 'mail', 'mail_secret', 'checkout', 'legal', 'error_pages']) { if (saved[k]) await db.query('UPDATE store_setting SET value=$2, updated_by=NULL WHERE key=$1', [k, saved[k].value]); else await db.query('DELETE FROM store_setting WHERE key=$1', [k]) }
    await db.query('DELETE FROM payment_credential')
    for (const c of saved.credentials || []) await db.query('INSERT INTO payment_credential(code,environment,public_config,secret_cipher) VALUES($1,$2,$3,$4)', [c.code, c.environment, c.public_config, c.secret_cipher])
    for (const id of twins) await db.query('DELETE FROM admin_user WHERE id=$1', [id])
    await db.query('DELETE FROM admin_user WHERE id=$1', [adminId])
  } catch (e) { console.error('limpieza incompleta:', e.message) }
  await db.end()
}
main().catch(e => { console.error(e.message); process.exitCode = 1 }).finally(cleanup)

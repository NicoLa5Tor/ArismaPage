// Uses a temporary administrator and removes all test records afterwards.
const { Client } = require('pg')
const crypto = require('node:crypto')
const db = new Client({ connectionString: process.env.DATABASE_URL })
const id=crypto.randomUUID(), password=crypto.randomBytes(24).toString('hex'), email=`smoke-${id}@example.invalid`
const salt=crypto.randomBytes(16), hash=`pbkdf2-sha256$600000$${salt.toString('hex')}$${crypto.pbkdf2Sync(password,salt,600000,32,'sha256').toString('hex')}`
let productId, objectKey, orderId
const extraOrders=[]
async function main(){
  await db.connect(); await db.query("INSERT INTO admin_user(id,email,name,role,password_hash) VALUES($1,$2,'Smoke','admin',$3)",[id,email,hash])
  const url='http://127.0.0.1:9001/api/admin'
  const unauth=await fetch(url+'/products'); if(unauth.status!==401) throw Error(`Expected 401, got ${unauth.status}`)
  const login=await fetch(url+'/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})}); if(!login.ok) throw Error(`Login failed ${login.status}`)
  const cookie=login.headers.get('set-cookie').split(';')[0], csrf=(await login.json()).csrf
  const denied=await fetch(url+'/products',{method:'POST',headers:{cookie,'Content-Type':'application/json'},body:'{}'}); if(denied.status!==401) throw Error('Mutation without CSRF was accepted')
  const create=await fetch(url+'/products',{method:'POST',headers:{cookie,'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify({title:'Smoke test',slug:`smoke-${id}`,status:'DRAFT',sku:null,regularPrice:100,manageStock:true,stockQuantity:2,quoteOnly:false,stockReason:'Prueba'})}); if(create.status!==201) throw Error(`Create failed ${create.status}: ${await create.text()}`)
  productId=(await create.json()).id
  if (process.env.TEST_S3 === '1') {
    const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/aN8AAAAASUVORK5CYII=','base64')
    const upload=await fetch(`${url}/products/${productId}/images`,{method:'POST',headers:{cookie,'Content-Type':'application/octet-stream','X-CSRF-Token':csrf},body:png})
    if(upload.status!==201) throw Error(`Image upload failed ${upload.status}: ${await upload.text()}`)
    const gallery=await upload.json(); if(gallery.length!==1 || !gallery[0].uploaded || !gallery[0].isPrimary) throw Error('Uploaded image is not the primary one')
    const content=await fetch(`${url}/products/${productId}/images/${gallery[0].id}/content`,{headers:{cookie}}); if(!content.ok || content.headers.get('content-type')!=='image/png') throw Error(`Image content failed ${content.status}`)
    const second=await (await fetch(`${url}/products/${productId}/images?alt=Detalle`,{method:'POST',headers:{cookie,'Content-Type':'application/octet-stream','X-CSRF-Token':csrf},body:png})).json()
    const promoted=await (await fetch(`${url}/products/${productId}/images/${second[1].id}/primary`,{method:'POST',headers:{cookie,'X-CSRF-Token':csrf}})).json(); if(promoted[0].id!==second[1].id || promoted[0].alt!=='Detalle') throw Error('Primary image change failed')
    for(const img of promoted){ const del=await fetch(`${url}/products/${productId}/images/${img.id}`,{method:'DELETE',headers:{cookie,'X-CSRF-Token':csrf}}); if(!del.ok) throw Error(`Image delete failed ${del.status}`) }
  }
  const list=await fetch(url+'/products?q='+encodeURIComponent(`smoke-${id}`),{headers:{cookie}}); if(!list.ok) throw Error(`List failed ${list.status}`)
  // Search profile: keywords come back cleaned, a broken age range is refused, and a write needs the CSRF token.
  const profile=body=>fetch(`${url}/products/${productId}/search`,{method:'PUT',headers:{cookie,'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify(body)})
  const kept=await profile({keywords:['  Puzzle ','puzzle','Armar  piezas'],ageMin:4,ageMax:7}); if(!kept.ok) throw Error(`Search profile save failed ${kept.status}: ${await kept.text()}`)
  const read=await (await fetch(`${url}/products/${productId}/search`,{headers:{cookie}})).json()
  if(read.keywords.join('|')!=='armar piezas|puzzle' || read.ageMin!==4 || read.ageMax!==7 || !Array.isArray(read.inheritedKeywords)) throw Error(`Search profile was not stored as expected: ${JSON.stringify(read)}`)
  if((await profile({keywords:['<b>x</b>'],ageMin:null,ageMax:null})).status!==400) throw Error('A keyword with markup was accepted')
  if((await profile({keywords:[],ageMin:9,ageMax:3})).status!==400) throw Error('An inverted age range was accepted')
  if((await fetch(`${url}/products/${productId}/search`,{method:'PUT',headers:{cookie,'Content-Type':'application/json'},body:'{}'})).status!==401) throw Error('Search profile change without CSRF was accepted')
  // A category's profile is inherited by its products; the original values are put back afterwards.
  const cat=(await db.query("SELECT id FROM category WHERE slug<>'uncategorized' ORDER BY name LIMIT 1")).rows[0]
  if(cat){
    const before=await (await fetch(`${url}/categories/${cat.id}/search`,{headers:{cookie}})).json()
    const putCat=body=>fetch(`${url}/categories/${cat.id}/search`,{method:'PUT',headers:{cookie,'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify(body)})
    try{
      await db.query('INSERT INTO product_category(product_id,category_id) VALUES($1,$2)',[productId,cat.id])
      const saved=await putCat({keywords:[...before.keywords,'smoke clave'],ageMin:3,ageMax:6}); if(!saved.ok) throw Error(`Category search save failed ${saved.status}: ${await saved.text()}`)
      const seen=await (await fetch(`${url}/products/${productId}/search`,{headers:{cookie}})).json()
      if(!seen.inheritedKeywords.includes('smoke clave') || seen.inheritedAgeMin!==3 || seen.inheritedAgeMax!==6) throw Error(`Product did not inherit the category profile: ${JSON.stringify(seen)}`)
    } finally {
      const restored=await putCat({keywords:before.keywords,ageMin:before.ageMin,ageMax:before.ageMax}); if(!restored.ok) throw Error(`Category search restore failed ${restored.status}`)
    }
  }
  const audit=await db.query('SELECT count(*)::int AS n FROM inventory_adjustment WHERE product_id=$1',[productId]); if(audit.rows[0].n!==1) throw Error(`Inventory adjustment was not recorded (${audit.rows[0].n})`)
  // Sales: a throwaway order whose cancellation must return its reduced stock.
  const get=async path=>{const r=await fetch(url+path,{headers:{cookie}}); if(!r.ok) throw Error(`GET ${path} failed ${r.status}: ${await r.text()}`); return r.json()}
  const post=(path,body,withCsrf=true)=>fetch(url+path,{method:'POST',headers:{cookie,'Content-Type':'application/json',...(withCsrf?{'X-CSRF-Token':csrf}:{})},body:JSON.stringify(body)})
  orderId=crypto.randomUUID()
  await db.query("INSERT INTO sales_order(id,number,status,subtotal,total,placed_at) VALUES($1,$2,'processing',200,238,now())",[orderId,`SMOKE-${id}`])
  await db.query('INSERT INTO order_line(id,order_id,product_id,title,quantity,unit_price,subtotal,tax,total,stock_reduced) VALUES($1,$2,$3,$4,2,100,200,38,200,2)',[crypto.randomUUID(),orderId,productId,'Smoke test'])
  const found=await get(`/orders?q=SMOKE-${id}`); if(found.total!==1) throw Error('Order search failed')
  const detail=await get(`/orders/${orderId}`); if(detail.lines.length!==1) throw Error('Order detail missing lines')
  if((await post(`/orders/${orderId}/status`,{status:'cancelled'},false)).status!==401) throw Error('Status change without CSRF was accepted')
  const cancel=await post(`/orders/${orderId}/status`,{status:'cancelled',note:'Prueba'}); if(!cancel.ok) throw Error(`Cancel failed ${cancel.status}: ${await cancel.text()}`)
  const stock=await db.query('SELECT stock_quantity FROM product WHERE id=$1',[productId]); if(stock.rows[0].stock_quantity!==4) throw Error(`Stock not returned, got ${stock.rows[0].stock_quantity}`)
  const invalid=await post(`/orders/${orderId}/status`,{status:'processing'}); if(invalid.status!==400 || !(await invalid.json()).error) throw Error('Invalid transition was accepted')
  const bulk=await (await post('/orders/status',{ids:[orderId],status:'completed'})).json(); if(bulk.updated!==0 || bulk.failed.length!==1) throw Error('Bulk change did not report the invalid order')
  const summary=await get('/reports/summary?from=2022-01-01'); if(!(Number(summary.sales)>0)) throw Error('Summary without sales')
  for(const path of ['/reports/sales-by-month?from=2025-01-01','/reports/top-products','/reports/payment-methods','/reports/shipping-methods','/reports/order-statuses','/customers','/quotes','/inventory/movements','/inventory/low-stock','/coupons','/tax-rates']) await get(path)
  // Deliveries: packing, shipping needs a tracking number, delivering completes the order.
  const order2=crypto.randomUUID(); extraOrders.push(order2)
  await db.query("INSERT INTO sales_order(id,number,status,subtotal,total,placed_at) VALUES($1,$2,'processing',100,119,now())",[order2,`SMOKE2-${id}`])
  const ship=(status,extra={})=>post(`/orders/${order2}/shipment/status`,{status,...extra})
  const packed=await ship('packed'); if(packed.status!==200) throw Error(`Packing failed ${packed.status}: ${await packed.text()}`)
  const noGuide=await ship('shipped'); if(noGuide.status!==400) throw Error(`Shipping without tracking should fail, got ${noGuide.status}`)
  const shipped=await ship('shipped',{carrier:'Servientrega',trackingCode:'SMK-1'}); if(!shipped.ok || (await shipped.json()).status!=='shipped') throw Error('Shipping failed')
  const delivered=await ship('delivered',{recipientName:'Portería'}); if(!delivered.ok) throw Error(`Delivery failed ${delivered.status}: ${await delivered.text()}`)
  if((await get(`/orders/${order2}`)).status!=='completed') throw Error('Delivering did not complete the order')
  const board=await get('/fulfillment/board'); if(typeof board.stale!=='number') throw Error('Board without stale count')
  if(!(await get(`/orders?stage=to_prepare,packed&limit=1`)).stageCounts) throw Error('Orders list without stage counts')
  // Roles: a seller created by the admin must change the temporary password, then can manage orders but not the catalog.
  const sellerEmail=`seller-${id}@example.invalid`
  const created=await post('/users',{email:sellerEmail,name:'Vendedora Smoke',role:'seller'}); if(created.status!==201) throw Error(`User create failed ${created.status}: ${await created.text()}`)
  const temp=(await created.json()).temporaryPassword
  const sLogin=await fetch(url+'/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:sellerEmail,password:temp})}); if(!sLogin.ok) throw Error('Seller login failed')
  const sCookie=sLogin.headers.get('set-cookie').split(';')[0], sBody=await sLogin.json(), sCsrf=sBody.csrf
  if(!sBody.user.mustChangePassword || sBody.user.role!=='seller') throw Error('Seller session should require a password change')
  const sReq=(m,path,body)=>fetch(url+path,{method:m,headers:{cookie:sCookie,'Content-Type':'application/json','X-CSRF-Token':sCsrf},body:body===undefined?undefined:JSON.stringify(body)})
  if((await fetch(url+'/orders',{headers:{cookie:sCookie}})).status!==403) throw Error('Pending password change should block the panel')
  if((await sReq('PUT','/me/password',{current:temp,next:'una frase muy segura de prueba'})).status!==204) throw Error('Password change failed')
  if((await fetch(url+'/orders',{headers:{cookie:sCookie}})).status!==200) throw Error('Seller cannot read orders')
  if((await sReq('PUT',`/products/${productId}`,{title:'x',slug:`smoke-${id}`,status:'DRAFT',regularPrice:1,manageStock:false})).status!==403) throw Error('Seller could edit a product')
  if((await fetch(url+'/users',{headers:{cookie:sCookie}})).status!==403) throw Error('Seller could list users')
  if((await sReq('POST',`/orders/${orderId}/notes`,{body:'Nota de vendedora'})).status!==201) throw Error('Seller could not add an order note')
  const sellerId=(await (await fetch(url+'/users',{headers:{cookie}})).json()).find(u=>u.email===sellerEmail).id
  if(!(await (await fetch(url+`/users/${sellerId}`,{method:'PUT',headers:{cookie,'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify({name:'Vendedora Smoke',role:'seller',active:false})})).ok)) throw Error('Deactivate failed')
  if((await fetch(url+'/orders',{headers:{cookie:sCookie}})).status!==401) throw Error('Deactivated seller kept access')
  // Five wrong passwords lock the account.
  let last; for(let i=0;i<5;i++) last=await fetch(url+'/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:sellerEmail,password:'incorrecta-'+i})})
  if(last.status!==429) throw Error(`Expected lockout 429, got ${last.status}`)
  await db.query('DELETE FROM order_note WHERE order_id=$1',[orderId]); await db.query('DELETE FROM admin_user WHERE email=$1',[sellerEmail])
  const logout=await fetch(url+'/session',{method:'DELETE',headers:{cookie,'X-CSRF-Token':csrf}}); if(logout.status!==200) throw Error(`Logout failed ${logout.status}`); const logoutBody = await logout.json(); if (!logoutBody.redirectUrl?.includes("/oidc/session/end")) throw Error("Logto logout redirect missing")
  console.log('Smoke test passed: authentication, CSRF, roles, forced password change, lockout, deliveries, product creation, inventory audit, orders, restock on cancel, reports, logout')
}
main().catch(e=>{console.error(e.message);process.exitCode=1}).finally(async()=>{try{for(const o of extraOrders) await db.query('DELETE FROM sales_order WHERE id=$1',[o]);if(orderId){await db.query('DELETE FROM inventory_adjustment WHERE order_line_id IN (SELECT id FROM order_line WHERE order_id=$1)',[orderId]);await db.query('DELETE FROM order_status_history WHERE order_id=$1',[orderId]);await db.query('DELETE FROM sales_order WHERE id=$1',[orderId])}if(productId){await db.query('DELETE FROM inventory_adjustment WHERE product_id=$1',[productId]);await db.query('DELETE FROM product WHERE id=$1',[productId])}await db.query("DELETE FROM admin_user WHERE email LIKE 'seller-%@example.invalid' AND created_by=$1",[id]);await db.query('DELETE FROM admin_user WHERE id=$1',[id]);if(objectKey) console.log(`Test object for cleanup: ${objectKey}`)}finally{await db.end()}})

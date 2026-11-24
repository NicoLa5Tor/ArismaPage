const crypto = require('node:crypto')
const { Client } = require('pg')
const { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME, DATABASE_URL } = process.env
if (!DATABASE_URL || /\/postgres(\?|$)/.test(DATABASE_URL) || !ADMIN_EMAIL || !ADMIN_PASSWORD || ADMIN_PASSWORD.length < 12) throw new Error('Set DATABASE_URL (the store database), ADMIN_EMAIL and ADMIN_PASSWORD (at least 12 characters)')
const salt=crypto.randomBytes(16), rounds=600000
const password=crypto.pbkdf2Sync(ADMIN_PASSWORD,salt,rounds,32,'sha256')
const hash=`pbkdf2-sha256$${rounds}$${salt.toString('hex')}$${password.toString('hex')}`
const db=new Client({connectionString:DATABASE_URL})
;(async()=>{await db.connect(); await db.query("INSERT INTO admin_user(id,email,name,role,password_hash) VALUES($1,$2,$3,'admin',$4)",[crypto.randomUUID(),ADMIN_EMAIL.trim().toLowerCase(),(ADMIN_NAME||ADMIN_EMAIL.split('@')[0]).trim(),hash]); console.log('Administrador creado')})().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>db.end())

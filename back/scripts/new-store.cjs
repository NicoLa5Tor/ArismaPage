// Sets up a new client store next to this installation's main store, on this machine: its own database, its own media
// bucket and its own ports, written to tiendas/<slug>/.env (secrets: never commit it). No data of other stores is touched or copied.
//
//   node scripts/new-store.cjs crear <slug>          database, bucket and tiendas/<slug>/.env
//   node scripts/new-store.cjs admin <slug>          first administrator (ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME)
//   node scripts/new-store.cjs lista                 stores set up here, with their ports
//
// It reads the local Postgres and MinIO credentials from back/.env (the same containers the main store uses). Run "admin"
// after the store's backend started once (./start-store.ps1 <slug>): the backend creates the tables.
const { Client } = require('pg')
const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')

const ROOT = path.resolve(__dirname, '..', '..')
const STORES = path.join(ROOT, 'tiendas')
const [command, slug] = process.argv.slice(2)

function readEnv(file) {
  const out = {}
  if (!fs.existsSync(file)) return out
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const i = line.indexOf('=')
    if (i > 0 && !line.trimStart().startsWith('#')) out[line.slice(0, i).trim()] = line.slice(i + 1).trim()
  }
  return out
}
const local = readEnv(path.join(ROOT, 'back', '.env'))
const fail = (message) => { console.error(message); process.exit(1) }
const checkSlug = () => {
  if (!slug || !/^[a-z][a-z0-9]{1,30}$/.test(slug)) fail('Escribe el nombre corto de la tienda: minúsculas y números, sin espacios. Ejemplo: node scripts/new-store.cjs crear jugueterianorte')
}
const storeEnv = (s) => readEnv(path.join(STORES, s, '.env'))
const stores = () => (fs.existsSync(STORES) ? fs.readdirSync(STORES).filter((d) => fs.existsSync(path.join(STORES, d, '.env'))) : [])
const dbUser = local.NORPRESS_DB_USER || 'norpress'
const project = local.NORPRESS_COMPOSE_PROJECT || 'norpress'
const admin = () => new Client({ host: '127.0.0.1', port: 5433, user: dbUser, password: local.NORPRESS_DB_PASSWORD, database: 'postgres' })

async function create() {
  checkSlug()
  if (!local.NORPRESS_DB_PASSWORD) fail('Falta NORPRESS_DB_PASSWORD en back/.env')
  const dir = path.join(STORES, slug), file = path.join(dir, '.env')
  if (fs.existsSync(file)) fail(`La tienda ${slug} ya existe (${path.relative(ROOT, file)}).`)

  // ports: the main store uses 9001 (back), 9002 (search) and 8000 (front); store n uses 9100+n, 9200+n and 3100+n
  const used = stores().map((s) => Number(storeEnv(s).STORE_NUMBER) || 0)
  const n = Math.max(0, ...used) + 1
  const database = `tienda_${slug}`, bucket = `tienda-${slug}-media`

  const db = admin()
  await db.connect()
  try {
    const exists = (await db.query('SELECT 1 FROM pg_database WHERE datname=$1', [database])).rowCount > 0
    if (exists) fail(`La base ${database} ya existe. Si es de una prueba anterior, bórrala antes: DROP DATABASE ${database};`)
    await db.query(`CREATE DATABASE ${database}`) // name checked above: letters and digits only
  } finally { await db.end() }

  try {
    execFileSync('docker', ['run', '--rm', '--network', `${project}_default`, '-e', 'MC_HOST_local',
      'cgr.dev/chainguard/minio-client:latest', 'mb', '--ignore-existing', `local/${bucket}`],
      { stdio: 'inherit', env: { ...process.env, MC_HOST_local: `http://${local.NORPRESS_S3_ACCESS_KEY}:${local.NORPRESS_S3_SECRET_KEY}@objectstore:9000` } })
  } catch { console.warn(`No se pudo crear el bucket ${bucket}: créalo a mano en MinIO (http://127.0.0.1:19011) antes de subir fotos.`) }

  const port = 9100 + n, searchPort = 9200 + n, frontPort = 3100 + n
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(file, [
    `# Tienda ${slug}: configuración local. Contiene secretos: no compartir ni subir a un repositorio.`,
    `STORE_NUMBER=${n}`,
    `PORT=${port}`,
    `DB_URL=jdbc:postgresql://localhost:5433/${database}`,
    `NORPRESS_S3_BUCKET=${bucket}`,
    // its own key: credentials saved in one store cannot be opened with another's
    `NORPRESS_SECRETS_KEY=${crypto.randomBytes(32).toString('base64')}`,
    `NORPRESS_PUBLIC_URL=http://${slug}.localhost:${frontPort}`,
    `NORPRESS_TRACKING_PLAN=free`,
    `SEARCH_PORT=${searchPort}`,
    `FRONT_PORT=${frontPort}`,
    '',
  ].join('\n'), { encoding: 'utf8', mode: 0o600 })

  console.log(`\nTienda ${slug} lista en ${path.relative(ROOT, file)}`)
  console.log(`  base ${database}, fotos en ${bucket}, back :${port}, tienda :${frontPort}, buscador :${searchPort}`)
  console.log('\nSiguientes pasos:')
  console.log(`  1. cd back;  ./start-store.ps1 ${slug}        (la primera vez crea las tablas)`)
  console.log(`  2. ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/new-store.cjs admin ${slug}`)
  console.log(`  3. cd front; ./start-store.ps1 ${slug}        y abre http://${slug}.localhost:${frontPort}/admin`)
  console.log('  4. En el panel: Tienda → Perfil, Pagos, Envíos y Correo. Luego categorías y productos.')
}

async function createAdmin() {
  checkSlug()
  const env = storeEnv(slug)
  if (!env.DB_URL) fail(`No existe la tienda ${slug}. Créala con: node scripts/new-store.cjs crear ${slug}`)
  const { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME } = process.env
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD || ADMIN_PASSWORD.length < 12) fail('Define ADMIN_EMAIL y ADMIN_PASSWORD (12 caracteres o más) y vuelve a ejecutar.')
  const database = env.DB_URL.split('/').pop()
  const db = new Client({ host: '127.0.0.1', port: 5433, user: dbUser, password: local.NORPRESS_DB_PASSWORD, database })
  await db.connect()
  try {
    const ready = (await db.query("SELECT to_regclass('public.admin_user') AS t")).rows[0].t
    if (!ready) fail(`La base ${database} aún no tiene tablas: arranca primero su backend (./start-store.ps1 ${slug}).`)
    const salt = crypto.randomBytes(16), rounds = 600000
    const hash = `pbkdf2-sha256$${rounds}$${salt.toString('hex')}$${crypto.pbkdf2Sync(ADMIN_PASSWORD, salt, rounds, 32, 'sha256').toString('hex')}`
    const email = ADMIN_EMAIL.trim().toLowerCase()
    await db.query("INSERT INTO admin_user(id,email,name,role,password_hash) VALUES($1,$2,$3,'admin',$4)", [crypto.randomUUID(), email, (ADMIN_NAME || email.split('@')[0]).trim(), hash])
    console.log(`Administrador ${email} creado en la tienda ${slug}. Borra ADMIN_PASSWORD de la terminal.`)
  } finally { await db.end() }
}

function list() {
  const all = stores()
  if (!all.length) { console.log('No hay tiendas nuevas. Crea una con: node scripts/new-store.cjs crear <slug>'); return }
  console.log('principal         back :9001  tienda :8000  buscador :9002')
  for (const s of all) { const e = storeEnv(s); console.log(`${s.padEnd(18)}back :${e.PORT}  tienda :${e.FRONT_PORT}  buscador :${e.SEARCH_PORT}`) }
}

const run = { crear: create, admin: createAdmin, lista: async () => list() }[command]
if (!run) fail('Uso: node scripts/new-store.cjs crear <slug> | admin <slug> | lista')
run().catch((e) => fail(e.message))

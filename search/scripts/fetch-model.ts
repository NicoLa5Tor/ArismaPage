// Downloads the embedding model once, into ./models, and pins every file's SHA-256 in model.lock.json.
// At runtime the service only reads these local files (no network) and refuses to start if a hash differs.
import { createHash } from "node:crypto"
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from "node:fs"
import { join, relative } from "node:path"
import { env, pipeline } from "@huggingface/transformers"
import { MODEL_DIR, MODEL_ID, MODEL_DTYPE, LOCK_FILE } from "../src/adapters/model-config.js"

env.cacheDir = MODEL_DIR
env.localModelPath = MODEL_DIR
env.allowRemoteModels = true

const extractor = await pipeline("feature-extraction", MODEL_ID, { dtype: MODEL_DTYPE })
await extractor("query: prueba", { pooling: "mean", normalize: true })

const files: Record<string, string> = {}
const walk = (dir: string) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) walk(path)
    else files[relative(MODEL_DIR, path).replaceAll("\\", "/")] = createHash("sha256").update(readFileSync(path)).digest("hex")
  }
}
walk(join(MODEL_DIR, MODEL_ID))

if (existsSync(LOCK_FILE)) {
  const pinned = JSON.parse(readFileSync(LOCK_FILE, "utf8")) as Record<string, string>
  const bad = Object.entries(pinned).filter(([file, hash]) => files[file] !== hash)
  if (bad.length) { console.error("El modelo descargado no coincide con model.lock.json:", bad.map(([f]) => f)); process.exit(1) }
  console.log("Modelo verificado contra model.lock.json")
} else {
  writeFileSync(LOCK_FILE, JSON.stringify(files, null, 2) + "\n")
  console.log("Modelo descargado y fijado en model.lock.json")
}
console.log(Object.keys(files).length, "archivos")

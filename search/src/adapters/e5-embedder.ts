import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { env, pipeline, type FeatureExtractionPipeline } from "@huggingface/transformers"
import type { Embedder } from "../application/ports.js"
import { LOCK_FILE, MODEL_DIR, MODEL_DTYPE, MODEL_ID } from "./model-config.js"

/**
 * multilingual-e5-small running on the CPU through ONNX Runtime. Loads only the local, hash-pinned files:
 * remote downloads are disabled, so nothing reaches the network at run time.
 */
export class E5Embedder implements Embedder {
  private constructor(private readonly extractor: FeatureExtractionPipeline) {}

  static async load(): Promise<E5Embedder> {
    verifyModelFiles()
    env.allowRemoteModels = false
    env.allowLocalModels = true
    env.localModelPath = MODEL_DIR
    env.cacheDir = MODEL_DIR
    // one thread and no memory arena: steadier, lower RAM on small servers (queries take ~10 ms either way)
    const extractor = await pipeline("feature-extraction", MODEL_ID, { dtype: MODEL_DTYPE, session_options: { enableCpuMemArena: false, enableMemPattern: false, intraOpNumThreads: 1 } })
    return new E5Embedder(extractor)
  }

  async query(text: string): Promise<number[]> {
    const output = await this.extractor(`query: ${text}`, { pooling: "mean", normalize: true })
    const vector = Array.from(output.data as Float32Array)
    output.dispose()
    return vector
  }

  async passages(texts: string[]): Promise<number[][]> {
    const output = await this.extractor(texts, { pooling: "mean", normalize: true })
    const vectors = output.tolist() as number[][]
    output.dispose()
    return vectors
  }
}

/** Refuses to start when a model file is missing or differs from model.lock.json (tampering or a partial download). */
function verifyModelFiles(): void {
  let pinned: Record<string, string>
  try { pinned = JSON.parse(readFileSync(LOCK_FILE, "utf8")) } catch { throw new Error("Falta model.lock.json: ejecuta `pnpm fetch-model`") }
  for (const [file, hash] of Object.entries(pinned)) {
    let actual: string
    try { actual = createHash("sha256").update(readFileSync(join(MODEL_DIR, file))).digest("hex") } catch { throw new Error(`Falta el archivo del modelo ${file}: ejecuta \`pnpm fetch-model\``) }
    if (actual !== hash) throw new Error(`El archivo del modelo ${file} no coincide con model.lock.json`)
  }
}

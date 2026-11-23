import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..")

/** Multilingual (Spanish included) sentence embeddings, 384 dimensions, ~120 MB quantized. */
export const MODEL_ID = "Xenova/multilingual-e5-small"
export const MODEL_DTYPE = "q8" as const
export const MODEL_DIM = 384
export const MODEL_DIR = join(root, "models")
export const LOCK_FILE = join(root, "model.lock.json")

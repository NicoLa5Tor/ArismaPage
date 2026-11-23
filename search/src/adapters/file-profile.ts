import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { z } from "zod"
import type { StoreProfile } from "../domain/profile.js"

const STORES_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "stores")

const text = z.string().trim().min(1)
const topic = z.object({ id: text, examples: z.array(text).min(3), replies: z.array(text).min(1), handoff: z.boolean().optional() }).strict()
const schema = z.object({
  name: text, locale: text, currency: text.length(3), offer: text, catalog: text,
  examples: z.array(text).length(2),
  starters: z.array(text).max(3).default([]),
  invitations: z.array(text).min(1),
  audienceWords: z.array(text).default([]),
  genericWords: z.array(text).default([]),
  slots: z.array(z.object({ id: z.enum(["age", "category", "budget"]), question: text, retry: text.optional() }).strict()).max(3).default([]),
  budgetSteps: z.array(z.number().positive()).max(5).default([]),
  topics: z.array(topic).default([]),
}).strict()

/** Reads stores/<id>.json. A wrong or missing field stops the start and names the field, instead of answering badly later. */
export function loadProfile(id: string): StoreProfile {
  if (!/^[a-z0-9-]+$/.test(id)) throw new Error(`STORE_PROFILE inválido: «${id}»`)
  const file = join(STORES_DIR, `${id}.json`)
  let raw: unknown
  try { raw = JSON.parse(readFileSync(file, "utf8")) } catch (error) { throw new Error(`No se pudo leer el perfil de tienda ${file}: ${(error as Error).message}`) }
  const parsed = schema.safeParse(raw)
  if (!parsed.success) throw new Error(`Perfil de tienda ${file} inválido: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`)
  return parsed.data
}

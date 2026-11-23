import type { Topic } from "../domain/dialogue.js"
import { stems, words } from "../domain/taxonomy.js"
import type { Embedder } from "./ports.js"

/**
 * Conversation is decided by comparison, not by a fixed bar: how close the message is to a taught phrase against how
 * close it is to the nearest product. Measured on the phrase bank (scripts/phrases.ts): store questions and small talk
 * sit 0.07 or more above their nearest product, product searches under 0.055.
 */
const CHAT_MARGIN = 0.06
/** Below this the message is not really like any taught phrase, whatever the products say. */
const CHAT_FLOOR = 0.85
/** Just above the margin the words get a say: a message mostly made of things the catalog sells is a search. */
const DOUBT = 0.03
const dot = (a: number[], b: number[]) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i]! * b[i]!; return s }

/**
 * The conversation topics with a vector per example phrase, computed once at start. Recognising a new way of
 * saying something only takes one more example in the domain file.
 */
export class DialogueState {
  private examples: { topic: Topic; vector: number[] }[] = []
  private readonly words: Map<string, Set<string>>

  constructor(private readonly topics: Topic[]) {
    this.words = new Map(topics.map((topic) => [topic.id, new Set(topic.examples.flatMap(stems))]))
  }

  async load(embedder: Embedder): Promise<void> {
    const examples: { topic: Topic; vector: number[] }[] = []
    for (const topic of this.topics) for (const example of topic.examples) examples.push({ topic, vector: await embedder.query(example) })
    this.examples = examples
  }

  /**
   * The topic the message is about, or null when it is a product search. `text` is what is left of the message after
   * courtesies and filler, and `bare` says it was courtesies only. `product` is how close the nearest product is in
   * meaning; `sells` tells whether the catalog names a word. `firm` asks for a clear win: the message also carries
   * something that usually means a search (an area, "barato", "descuento").
   * Store questions may use their own vocabulary ("tienda", "tarjeta"); small talk has none, so "kit de robótica"
   * is never taken for "eres un robot".
   */
  match(vector: number[], text: string, bare: boolean, product: number, sells: (word: string) => boolean, firm = false): Topic | null {
    let best: { topic: Topic; score: number } | null = null
    for (const { topic, vector: example } of this.examples) {
      const score = dot(vector, example)
      if (!best || score > best.score) best = { topic, score }
    }
    if (!best) return null
    // nothing but courtesies ("hola, buenas tardes"): always conversation
    if (bare) return best.topic
    const margin = best.score - product
    if (best.score < CHAT_FLOOR || margin < CHAT_MARGIN + (firm ? 0.01 : 0)) return null
    if (margin >= CHAT_MARGIN + DOUBT) return best.topic
    // only filler left ("algo"): too little to call it conversation on a narrow win
    if (!text) return null
    const own = best.topic.store ? this.words.get(best.topic.id)! : new Set<string>()
    const content = words(text)
    const sold = content.filter((word) => !own.has(word.slice(0, 5)) && sells(word))
    return sold.length > 0 && sold.length * 2 >= content.length ? null : best.topic
  }
}

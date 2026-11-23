// Ready-made answers in Spanish, built from what was understood and found. No generative model involved.
import type { Intent } from "./query.js"
import { type Taxonomy, categoryName } from "./taxonomy.js"

const cop = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 })
const pesos = (amount: number) => cop.format(amount)

/** Stable choice among phrasings, so the same question always reads the same. */
function pick<T>(options: T[], seed: string): T {
  let h = 0
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return options[h % options.length]!
}

/** "para 5 años, en Matemáticas, por menos de $50.000" — only the parts that were understood. */
export function describeIntent(intent: Intent, taxonomy: Taxonomy, money: (amount: number) => string = pesos): string {
  const parts: string[] = []
  if (intent.age) parts.push(intent.age.min === intent.age.max ? `para ${intent.age.min} ${intent.age.min === 1 ? "año" : "años"}` : `para ${intent.age.min} a ${intent.age.max} años`)
  const area = categoryName(taxonomy, intent.category)
  if (area) parts.push(`en ${area}`)
  if (intent.maxPrice) parts.push(`por menos de ${money(intent.maxPrice)}`)
  if (intent.offers) parts.push("en oferta")
  if (intent.cheap) parts.push("del más económico al más caro")
  return parts.join(", ")
}

/** "Lo busqué como «jirafa»." when the shopper's words were corrected to the catalog's spelling. */
export const composeReadAs = (fixed: string[]) => `Lo busqué como «${[...new Set(fixed)].join(" ")}». `

/** The shopper named a product and it is here. */
export function composeExact(matches: number, others: number): string {
  const lead = matches === 1 ? "Este es el que buscas." : `Estos ${matches} coinciden con lo que escribiste.`
  return others > 0 ? `${lead} Te dejo también ${others === 1 ? "uno parecido" : `${others} parecidos`}; si quieres ver más, pídemelos.` : lead
}

/** "De los 12 que te mostré, estos son los más económicos:" */
export function composeOrdered(order: "cheap" | "pricey", seen: number, found: number): string {
  const which = order === "cheap" ? "económico" : "caro"
  return found === 1 ? `De los ${seen} que te mostré, el más ${which} es este.` : `De los ${seen} que te mostré, estos son los más ${which}s.`
}

/** Asked for an age and no product states one: the products are shown, and the doubt is said out loud. */
export const composeAgeUnmarked = (ages: string) =>
  `Estos productos no tienen la edad marcada, así que no puedo asegurarte cuáles son ${ages}. Te los dejo para que los revises; un asesor te confirma por WhatsApp cuáles le sirven.`

/** A new condition that nothing meets: said plainly, and the search stays as it was. */
export function composeNothing(about: string, subject: string): string {
  const what = [subject ? `«${subject}»` : "", about].filter(Boolean).join(", ")
  return `No encontré nada${what ? ` ${subject ? "de " : ""}${what}` : ""}, ni entre los que te mostré ni en el resto del catálogo. Sigo con la búsqueda como estaba; dime otra condición o pide ver más.`
}

/** How many of the products on screen meet the new condition, and whether the rest came from the catalog. */
export function composeNarrowed(about: string, kept: number, added: number): string {
  const scope = about ? ` ${about}` : ""
  if (kept === 0) return `De los que te mostré ninguno encaja${scope}, así que busqué en todo el catálogo.`
  const lead = kept === 1 ? `De los que te mostré, este encaja${scope}.` : `De los que te mostré, estos ${kept} encajan${scope}.`
  return added > 0 ? `${lead} Después van otros del catálogo.` : lead
}

/** `thread` is set when the message built on the previous search: its subject and whether it asked for more of the same. */
export function composeReply(query: string, intent: Intent, taxonomy: Taxonomy, found: number, money: (amount: number) => string = pesos, thread?: { subject: string; more: boolean }): string {
  const about = describeIntent(intent, taxonomy, money)
  if (thread) {
    // "«rompecabezas», para 6 años" with a subject; just "para 6 años, en Didácticos" when the search is only conditions
    const named = thread.subject ? `«${thread.subject}»${about ? `, ${about}` : ""}` : ""
    const scope = (before: string) => (named ? ` ${before} ${named}` : about ? ` ${about}` : "")
    if (thread.more) return found === 0 ? `Ya te mostré todo lo que encaja${scope("con")}. Prueba con otra idea o quita alguna condición.` : `Aquí van ${found === 1 ? "otra opción" : `otras ${found} opciones`}${scope("de")}.`
    if (found === 0) return `No encontré nada${scope("para")}. Quita alguna condición o cuéntame otra idea, y si prefieres te ayudamos por WhatsApp.`
    const count = found === 1 ? "Es el único que encaja por ahora." : `Te muestro ${found} que encajan.`
    return named ? `Listo, sigo con ${named}. ${count}` : `Listo${about ? `: ${about}` : ""}. ${count}`
  }
  if (found === 0) {
    return pick([
      `No encontré productos para «${query.trim()}»${about ? ` ${about}` : ""}. Prueba con otras palabras o quita alguna condición, y si prefieres te ayudamos por WhatsApp.`,
      `Esta vez no di con nada para «${query.trim()}». Intenta describirlo de otra forma o escríbenos por WhatsApp y lo buscamos contigo.`,
    ], query)
  }
  const lead = pick([`Estos productos te pueden servir`, `Esto es lo que mejor encaja con lo que buscas`, `Encontré opciones que te pueden gustar`], query)
  const scope = about ? ` ${about}` : ""
  const tail = found === 1 ? "Es el único que encaja por ahora." : `Te muestro los ${found} más relevantes; puedes afinar con las sugerencias de abajo.`
  return `${lead}${scope}. ${tail}`
}

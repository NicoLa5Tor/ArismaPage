// Conversation that is not a product search: greetings, thanks and the store questions shoppers ask before buying.
// Each topic is taught by examples (the embedder matches new phrasings by meaning) and always answers with an
// invitation to keep asking. Small talk is the same for every store; store questions and their answers come from
// the store's profile. There is no generative model.
import type { StoreProfile } from "./profile.js"
import { fold } from "./taxonomy.js"

export type Topic = {
  id: string
  /** How shoppers say it. More examples make the topic easier to recognise; no retraining needed. */
  examples: string[]
  replies: string[]
  /** Offer the store's contact button with the answer. */
  handoff?: boolean
  /** A store question (shipping, payments…) rather than small talk: its own words are never taken for product names. */
  store?: boolean
}

/** Small talk plus the store's own questions. */
export function buildTopics(profile: StoreProfile): Topic[] {
  const { name, offer, catalog, examples } = profile
  return [
    {
      id: "greeting",
      examples: ["hola", "holaa", "ola", "holi", "buenas", "buenos días", "buenas tardes", "buenas noches", "hey", "saludos", "qué más", "quiubo", "wenas", "buenass", "holi holi", "qué hubo", "quihubo", "qué hay", "hola buenas tardes", `hola ${name}`],
      replies: [
        `¡Hola! Qué gusto saludarte. Soy el asistente de ${name} y te ayudo a encontrar ${offer}.`,
        `¡Hola! Te damos la bienvenida a ${name}. Aquí encuentras ${offer}.`,
      ],
    },
    {
      id: "wellbeing",
      examples: ["cómo estás", "hola cómo estás", "como estas", "qué tal", "hola qué tal", "cómo te va", "cómo vas", "cómo va todo", "todo bien", "qué más pues", "cómo amaneces", "hola como te encuentras"],
      replies: [
        "¡Muy bien, gracias por preguntar! Con ganas de ayudarte a encontrar lo que buscas.",
        "¡Todo bien por aquí, gracias! Listo para buscar contigo en el catálogo.",
      ],
    },
    {
      id: "thanks",
      examples: ["gracias", "grasias", "grax", "muchas gracias", "mil gracias", "te lo agradezco", "muy amable", "perfecto gracias", "listo gracias", "ok gracias", "genial gracias", "gracias por la ayuda", "excelente", "perfecto", "súper", "vale", "dale", "bueno listo", "de una", "entendido"],
      replies: [
        "¡Con mucho gusto! Si quieres ver algo más, aquí sigo.",
        "¡A ti por escribirnos! Podemos seguir buscando cuando quieras.",
      ],
    },
    {
      id: "farewell",
      examples: ["chao", "adiós", "hasta luego", "nos vemos", "hasta pronto", "bye", "feliz día", "feliz tarde", "que estés bien", "me voy"],
      replies: [
        "¡Hasta pronto! Cuando quieras retomar, escríbeme lo que buscas y seguimos.",
        "¡Que tengas un buen día! Aquí estaré cuando necesites encontrar algo.",
      ],
    },
    {
      id: "identity",
      examples: ["quién eres", "eres un robot", "eres una persona", "eres una inteligencia artificial", "con quién hablo", "cómo te llamas", "eres humano", "eres un bot", "hablo con una persona real", "qué eres", "estoy hablando con una máquina", "esto es automático"],
      replies: [
        `Soy el asistente de búsqueda de ${name}: un programa, no una persona. Leo lo que escribes y te muestro productos reales del catálogo. Si prefieres hablar con alguien del equipo, dímelo y te cuento cómo.`,
      ],
    },
    {
      id: "help",
      examples: ["qué puedes hacer", "en qué me puedes ayudar", "ayuda", "cómo funciona esto", "para qué sirves", "no sé qué buscar", "qué me recomiendas", "necesito ayuda", "cómo te pregunto", "qué venden", "qué tienen", "qué productos manejan", "a qué se dedican"],
      replies: [
        `Busco por ti en el catálogo de ${name}: ${catalog}. Escríbeme como le hablarías a un asesor, por ejemplo «${examples[0]}» o «${examples[1]}».`,
      ],
    },
    ...profile.topics.map((topic) => ({ ...topic, store: true })),
  ]
}

/** Greetings and courtesies that may open or close a real search ("hola, busco rompecabezas, gracias"). Language, not catalog data. */
export const COURTESY = /\b(hola+|ola|holi|hey|buen(?:as|os)?(?: dias?| tardes?| noches?)?|saludos|que mas|quiubo|como (?:estas?|vas|te va)|que tal|(?:muchas |mil )?gracias|muy amable|por favor|porfa(?:vor)?|disculpa|oye|mira)\b/g
const GREETING = /^\s*(hola+|ola|holi|hey|buen(?:as|os)?|saludos|que mas|quiubo)\b/

/** Whether the message opens with a greeting ("hola, busco rompecabezas"). */
export const greets = (raw: string) => GREETING.test(fold(raw).replace(/[^a-z0-9\s]/g, " "))

function pick<T>(options: T[], seed: string): T {
  let h = 0
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return options[h % options.length]!
}

/** The topic's answer followed by a question that brings the shopper back to the catalog. */
export function composeChat(topic: Topic, query: string, greeted: boolean, invitations: string[]): string {
  const hello = greeted && topic.id !== "greeting" && topic.id !== "wellbeing" ? "¡Hola! " : ""
  const invite = topic.id === "farewell" || !invitations.length ? "" : ` ${pick(invitations, query)}`
  return `${hello}${pick(topic.replies, query)}${invite}`
}

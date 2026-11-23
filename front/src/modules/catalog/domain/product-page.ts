// Content of a product's public page and which of its sections are shown. Mirrors the rules the backend enforces.

export type SectionKey = "buy" | "whatsapp" | "stock" | "sku" | "highlights" | "description" | "specs" | "age" | "categories" | "shipping" | "reviews" | "questions" | "related"
/** "inherit" follows the store default; the other two are this product's own decision. */
export type Visibility = "inherit" | "show" | "hide"
export type Spec = { label: string; value: string }
export type ProductPage = { shortDescription: string; descriptionHtml: string; highlights: string[]; specs: Spec[]; sections: Partial<Record<SectionKey, Visibility>> }

export const LIMITS = { short: 300, description: 20_000, highlights: 6, highlight: 120, specs: 20, label: 40, value: 160 } as const

/** Sections in page order, with the words the panel uses for each. */
export const SECTIONS: { key: SectionKey; title: string; hint: string }[] = [
  { key: "buy", title: "Botón de compra", hint: "Agregar al carrito y cantidad. Sin él, el producto solo se cotiza." },
  { key: "whatsapp", title: "Botón de WhatsApp", hint: "Preguntar o cotizar con un asesor." },
  { key: "stock", title: "Disponibilidad", hint: "Disponible, sobre pedido o cuántas unidades quedan." },
  { key: "highlights", title: "Destacados", hint: "Las frases cortas junto al precio." },
  { key: "description", title: "Descripción", hint: "El texto largo del producto." },
  { key: "specs", title: "Ficha del producto", hint: "Material, medidas y los demás datos." },
  { key: "age", title: "Edad recomendada", hint: "La del producto o la de sus categorías." },
  { key: "sku", title: "Referencia (SKU)", hint: "El código interno del producto." },
  { key: "categories", title: "Categorías", hint: "Enlaces a las categorías del producto." },
  { key: "shipping", title: "Cómo lo recibes", hint: "Envíos, pagos, garantía y tienda." },
  { key: "reviews", title: "Opiniones", hint: "Calificaciones y reseñas de clientes." },
  { key: "questions", title: "Preguntas", hint: "Preguntas de clientes y respuestas de la tienda." },
  { key: "related", title: "Productos relacionados", hint: "Otros productos de las mismas categorías." },
]

export const emptyPage: ProductPage = { shortDescription: "", descriptionHtml: "", highlights: [], specs: [], sections: {} }

/** First problem the backend would refuse, so the editor can say it before saving. */
export function pageError(page: ProductPage): string | null {
  if (page.shortDescription.length > LIMITS.short) return `La descripción corta admite máximo ${LIMITS.short} caracteres`
  if (page.descriptionHtml.length > LIMITS.description) return "La descripción es demasiado larga"
  if (page.highlights.some((h) => h.length > LIMITS.highlight)) return `Cada destacado admite máximo ${LIMITS.highlight} caracteres`
  const filled = page.specs.filter((s) => s.label.trim() || s.value.trim())
  if (filled.some((s) => !s.label.trim() || !s.value.trim())) return "Cada dato de la ficha lleva nombre y valor"
  if (filled.some((s) => s.label.length > LIMITS.label || s.value.length > LIMITS.value)) return "Un dato de la ficha es demasiado largo"
  const labels = filled.map((s) => s.label.trim().toLowerCase())
  if (new Set(labels).size !== labels.length) return "La ficha repite un dato"
  return null
}

/** What is sent: trimmed, without empty rows and without "inherit" entries. */
export function cleanPage(page: ProductPage): ProductPage {
  const sections: ProductPage["sections"] = {}
  for (const [key, value] of Object.entries(page.sections) as [SectionKey, Visibility][]) if (value !== "inherit") sections[key] = value
  return {
    shortDescription: page.shortDescription.trim(), descriptionHtml: page.descriptionHtml.trim(),
    highlights: page.highlights.map((h) => h.trim()).filter(Boolean),
    specs: page.specs.map((s) => ({ label: s.label.trim(), value: s.value.trim() })).filter((s) => s.label && s.value),
    sections,
  }
}

// Client-side mirror of back/.../media/domain: same limits, checked before uploading so errors appear instantly.
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
export const MAX_IMAGES = 30
export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"]
/** Reason a file cannot be uploaded, or null when it is fine. */
export function rejectFile(file: { type: string; size: number }): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) return "Formato no admitido: usa JPEG, PNG o WebP"
  if (file.size > MAX_IMAGE_BYTES) return "Pesa más de 5 MB"
  if (file.size === 0) return "El archivo está vacío"
  return null
}
/** Moves one item by offset, keeping the others in order. */
export function move<T>(list: T[], index: number, offset: number): T[] {
  const target = index + offset
  if (target < 0 || target >= list.length) return list
  const next = [...list]; const [item] = next.splice(index, 1); next.splice(target, 0, item)
  return next
}
/** Slug from a product name: lowercase, no accents, hyphens. */
export const slugify = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")

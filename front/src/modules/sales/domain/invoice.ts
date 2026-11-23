// The invoice of an order as the panel sends it: a PDF made in the store's billing program, emailed or shared by WhatsApp.

export type InvoiceStatus = "pending" | "uploaded" | "sent" | "not_needed"
export type InvoiceChannel = "email" | "whatsapp"
/** From the invoice endpoint; `link` is the download address the customer gets. */
export type Invoice = { status: InvoiceStatus; number: string | null; fileName: string | null; channels: InvoiceChannel[]; link: string | null }
/** What the order detail carries about its invoice (no link: that one comes from the invoice endpoint). */
export type InvoiceSummary = { status: Exclude<InvoiceStatus, "pending">; number: string | null; fileName: string | null; channels: string; sentTo: string | null; sentAt: string | null }

export const MAX_INVOICE_BYTES = 10 * 1024 * 1024

/** Checks the file before uploading it; the backend checks again that it really is a PDF. */
export function invoiceFileError(file: File): string | null {
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) return "Elige el PDF de la factura."
  if (file.size === 0) return "El archivo está vacío."
  if (file.size > MAX_INVOICE_BYTES) return "El PDF pesa más de 10 MB; exporta la factura más liviana."
  return null
}

/** The WhatsApp message with the download link, in the store's voice. */
export function invoiceMessage({ firstName, store, orderNumber, invoiceNumber, link }: { firstName: string | null | undefined; store: string; orderNumber: string; invoiceNumber: string | null; link: string }) {
  const hello = firstName?.trim() ? `Hola ${firstName.trim().split(/\s+/)[0]}` : "Hola"
  const which = invoiceNumber ? `la factura ${invoiceNumber}` : "la factura"
  return `${hello}, te escribimos de ${store}. Aquí está ${which} de tu pedido #${orderNumber}. Puedes descargarla en este enlace: ${link}

Gracias por tu compra.`
}

export const channelLabel = (channels: string[]) => channels.map(c => c === "email" ? "correo" : c === "whatsapp" ? "WhatsApp" : c).join(" y ")

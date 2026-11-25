// The store's own error pages, written in the panel (Sitio → Páginas de error) in HTML, CSS and JavaScript.
// They never run inside the store's page: a sandboxed frame shows them (see ui/error-frame.tsx).

export type ErrorPageKind = "not_found" | "error"
export type ErrorPage = { html: string; css: string; js: string }

/** Classes of the store's design the page can use as they are (the frame's body already has class "storefront"). */
export const STORE_CLASSES: { name: string; use: string }[] = [
  { name: "eyebrow", use: "Texto pequeño en mayúsculas sobre un título, en el color de la marca." },
  { name: "button-primary", use: "Botón principal de la tienda (úsalo en un <a> o <button>)." },
  { name: "link-arrow", use: "Enlace secundario con flecha, como «Pregúntale al asistente»." },
  { name: "store-missing-body", use: "Bloque centrado de la página de error de la tienda: título, texto y acciones." },
  { name: "store-missing-actions", use: "Fila de botones bajo el texto." },
]
/** CSS variables of the store's design. */
export const STORE_VARIABLES: { name: string; use: string }[] = [
  { name: "--brand-pink", use: "Color de la marca." },
  { name: "--brand-pink-strong", use: "Color de la marca para botones y textos destacados." },
  { name: "--ease-out", use: "Curva de las animaciones de la tienda." },
  { name: "--font-poppins", use: "Tipografía de la tienda (ya es la del cuerpo)." },
]
/** What the frame gives the page's JavaScript, ready to use without importing anything. */
export const STORE_SCRIPT: { name: string; use: string }[] = [
  { name: "tienda.nombre", use: "Nombre de la tienda." },
  { name: "tienda.ruta", use: "Dirección que el cliente intentó abrir (en la página 404)." },
  { name: "tienda.ir(ruta)", use: "Lleva al cliente a otra página de la tienda, por ejemplo tienda.ir('/productos')." },
  { name: "tienda.buscar(texto)", use: "Abre el catálogo con esa búsqueda." },
  { name: "tienda.whatsapp(mensaje)", use: "Enlace al WhatsApp de la tienda con ese mensaje escrito; vacío si la tienda no tiene WhatsApp." },
  { name: "tienda.reintentar()", use: "En la página de error: vuelve a intentar cargar la página." },
]

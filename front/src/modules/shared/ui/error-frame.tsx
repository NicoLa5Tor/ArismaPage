"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { ErrorPage } from "../domain/error-page"

type Props = {
  page: ErrorPage
  /** The store's name and WhatsApp, for the `tienda` helper. */
  store: { name: string; whatsapp: string }
  /** The address that failed (404). */
  path?: string
  /** "Reintentar" on the error page. */
  onRetry?: () => void
  title: string
  className?: string
}

const MESSAGE = "norpress-error-page"

/**
 * The store's own error page, in a sandboxed frame. The store's HTML, CSS and JavaScript run there with an opaque
 * origin: they use the store's stylesheets (copied into the frame) and the `tienda` helper, but they cannot read the
 * shopper's session, cookies or the page around them. Links open in the whole window; the frame grows with its content.
 */
export function ErrorFrame({ page, store, path = "", onRetry, title, className = "" }: Props) {
  const frame = useRef<HTMLIFrameElement>(null)
  const [styles, setStyles] = useState<{ links: string[]; inline: string; html: string } | null>(null)
  const [height, setHeight] = useState(480)

  // the store's own styles and font variables, copied from this page once it is in the browser: the frame has no origin
  // of its own, so it gets the rules as text (a sheet it cannot read, from another host, goes as a link)
  useEffect(() => {
    const links: string[] = [], rules: string[] = []
    for (const sheet of Array.from(document.styleSheets)) {
      try { rules.push(Array.from(sheet.cssRules).map((rule) => rule.cssText).join("\n")) }
      catch { if (sheet.href) links.push(sheet.href) }
    }
    setStyles({ links, inline: rules.join("\n"), html: document.documentElement.className })
  }, [])

  useEffect(() => {
    const listen = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || typeof event.data !== "object" || event.data?.type !== MESSAGE) return
      const data = event.data as { action: string; value?: unknown }
      if (data.action === "height" && typeof data.value === "number") setHeight(Math.min(Math.max(240, Math.ceil(data.value)), 20000))
      if (data.action === "retry") onRetry?.()
      // only addresses of this store, never another site
      if (data.action === "go" && typeof data.value === "string" && data.value.startsWith("/") && !data.value.startsWith("//")) window.location.assign(data.value)
    }
    window.addEventListener("message", listen)
    return () => window.removeEventListener("message", listen)
  }, [onRetry])

  const doc = useMemo(() => styles && frameDocument(page, store, path, styles), [page, store, path, styles])
  if (!doc) return <div className={className} style={{ minHeight: height }} aria-hidden="true" />
  return <iframe ref={frame} title={title} srcDoc={doc} className={className} style={{ width: "100%", height, border: 0, display: "block" }}
    sandbox="allow-scripts allow-top-navigation-by-user-activation allow-popups allow-popups-to-escape-sandbox" referrerPolicy="no-referrer" />
}

const attr = (value: string) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;")
/** Text that cannot close the tag it is written in. */
const inside = (code: string, tag: "script" | "style") => code.replace(new RegExp(`</${tag}`, "gi"), `<\\/${tag}`)

function frameDocument(page: ErrorPage, store: Props["store"], path: string, styles: { links: string[]; inline: string; html: string }) {
  const origin = window.location.origin
  const helper = `(() => {
  const post = (action, value) => parent.postMessage({ type: ${JSON.stringify(MESSAGE)}, action, value }, "*");
  const whatsapp = ${JSON.stringify(store.whatsapp)};
  window.tienda = Object.freeze({
    nombre: ${JSON.stringify(store.name)},
    ruta: ${JSON.stringify(path)},
    ir: (ruta) => post("go", String(ruta || "/")),
    buscar: (texto) => post("go", "/productos?q=" + encodeURIComponent(String(texto || ""))),
    whatsapp: (mensaje) => whatsapp ? "https://wa.me/" + whatsapp + "?text=" + encodeURIComponent(String(mensaje || "")) : "",
    reintentar: () => post("retry"),
  });
  const size = () => post("height", document.documentElement.scrollHeight);
  new ResizeObserver(size).observe(document.documentElement);
  addEventListener("load", size);
})();`
  return `<!doctype html><html lang="es-CO" class="${attr(styles.html)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">`
    + `<base href="${attr(origin)}/" target="_top">`
    + styles.links.map((href) => `<link rel="stylesheet" href="${attr(href)}">`).join("")
    + (styles.inline ? `<style>${inside(styles.inline, "style")}</style>` : "")
    + `<style>html,body{margin:0;background:transparent}</style>`
    + (page.css ? `<style>${inside(page.css, "style")}</style>` : "")
    + `</head><body class="storefront">${page.html}<script>${inside(helper, "script")}</script>`
    + (page.js ? `<script>${inside(page.js, "script")}</script>` : "")
    + `</body></html>`
}

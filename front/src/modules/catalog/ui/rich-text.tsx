"use client"

import { useEffect, useId, useRef, useState } from "react"
import { LinkSimple, ListBullets, ListNumbers, TextB, TextHThree, TextT } from "@phosphor-icons/react"

type Command = { id: string; label: string; icon: typeof TextB; run: () => void; active?: () => boolean }

/**
 * A small editor for product descriptions: bold, subheadings, lists and links, nothing else (the store shows only
 * those, and the backend cleans whatever arrives). Pasted text comes in plain, so formatting from other sites never
 * sneaks in. The value is HTML.
 */
export function RichText({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (html: string) => void; placeholder?: string }) {
  const id = useId()
  const editor = useRef<HTMLDivElement>(null)
  const [, setTick] = useState(0)
  const last = useRef(value)
  const saved = useRef<Range | null>(null)
  const [linking, setLinking] = useState(false), [ranged, setRanged] = useState(false), [url, setUrl] = useState(""), [linkError, setLinkError] = useState("")

  // only external changes rewrite the content, so the caret does not jump while typing
  useEffect(() => {
    if (editor.current && value !== last.current) { editor.current.innerHTML = value; last.current = value }
  }, [value])
  useEffect(() => { if (editor.current) editor.current.innerHTML = value }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const emit = () => {
    const html = editor.current?.innerHTML ?? ""
    const clean = html === "<br>" || html === "<p><br></p>" ? "" : html
    last.current = clean
    onChange(clean)
  }
  const exec = (command: string, argument?: string) => {
    editor.current?.focus()
    document.execCommand(command, false, argument)
    emit(); setTick((n) => n + 1)
  }
  const block = (tag: string) => {
    const current = (document.queryCommandValue("formatBlock") || "").toLowerCase()
    exec("formatBlock", current === tag ? "p" : tag)
  }
  // the selection is kept while the address is typed in the field below the toolbar
  const link = () => {
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed || !editor.current?.contains(selection.anchorNode)) { setLinkError("Selecciona primero el texto del enlace"); setRanged(false); setLinking(true); return }
    saved.current = selection.getRangeAt(0).cloneRange(); setRanged(true)
    setLinkError(""); setUrl(""); setLinking(true)
  }
  const applyLink = () => {
    const address = url.trim()
    if (!/^(https?:\/\/|mailto:|tel:)\S+$/i.test(address)) { setLinkError("Escribe una dirección que empiece por https://"); return }
    if (!saved.current) { setLinkError("Selecciona primero el texto del enlace"); return }
    const selection = window.getSelection()
    selection?.removeAllRanges(); selection?.addRange(saved.current)
    exec("createLink", address)
    saved.current = null; setLinking(false); setUrl("")
  }
  const isActive = (command: string) => { try { return document.queryCommandState(command) } catch { return false } }
  const commands: Command[] = [
    { id: "bold", label: "Negrita", icon: TextB, run: () => exec("bold"), active: () => isActive("bold") },
    { id: "h3", label: "Subtítulo", icon: TextHThree, run: () => block("h3") },
    { id: "ul", label: "Lista con viñetas", icon: ListBullets, run: () => exec("insertUnorderedList"), active: () => isActive("insertUnorderedList") },
    { id: "ol", label: "Lista numerada", icon: ListNumbers, run: () => exec("insertOrderedList"), active: () => isActive("insertOrderedList") },
    { id: "link", label: "Enlace (selecciona el texto primero)", icon: LinkSimple, run: link },
    { id: "clear", label: "Quitar formato", icon: TextT, run: () => { exec("removeFormat"); exec("formatBlock", "p") } },
  ]

  return (
    <div className="grid gap-2">
      <span className="glass-label" id={`${id}-label`}>{label}</span>
      <div className="rich-toolbar" role="toolbar" aria-label={`Formato de ${label.toLowerCase()}`}>
        {commands.map((c) => <button key={c.id} type="button" title={c.label} aria-label={c.label} aria-pressed={c.active ? c.active() : undefined} onMouseDown={(e) => e.preventDefault()} onClick={c.run}><c.icon size={18} aria-hidden="true" /></button>)}
      </div>
      {linking && <div className="rich-link">
        {ranged && <input className="glass-field" type="url" value={url} autoFocus placeholder="https://…" aria-label="Dirección del enlace" onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyLink() } if (e.key === "Escape") setLinking(false) }} />}
        {ranged && <button type="button" className="glass-chip" onClick={applyLink}>Poner enlace</button>}
        <button type="button" className="glass-chip" onClick={() => { setLinking(false); setLinkError("") }}>Cerrar</button>
        {linkError && <span className="glass-field-error" role="alert">{linkError}</span>}
      </div>}
      <div ref={editor} className="glass-field rich-editor" contentEditable suppressContentEditableWarning role="textbox" aria-multiline="true" aria-labelledby={`${id}-label`}
        data-placeholder={placeholder} onInput={emit} onBlur={emit} onKeyUp={() => setTick((n) => n + 1)} onMouseUp={() => setTick((n) => n + 1)}
        onPaste={(e) => { e.preventDefault(); document.execCommand("insertText", false, e.clipboardData.getData("text/plain")) }} />
    </div>
  )
}

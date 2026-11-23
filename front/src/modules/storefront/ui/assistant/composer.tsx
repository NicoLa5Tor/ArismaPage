"use client"

import { useEffect, useRef, type KeyboardEvent } from "react"
import { ArrowUp, Stop } from "@phosphor-icons/react"
import { MAX_QUESTION_LENGTH } from "../../domain/assistant"
import { useAskLabel } from "../store-brand"

const BEAMS = ["#ff1850", "#29aae2", "#fd931f", "#79c942"]

/** Where the shopper writes. Enter sends, Shift+Enter breaks the line, Ctrl/⌘+K focuses it from anywhere. */
export function Composer({ value, onChange, onSend, onStop, busy }: { value: string; onChange: (value: string) => void; onSend: () => void; onStop: () => void; busy: boolean }) {
  const askLabel = useAskLabel()
  const input = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = input.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [value])

  // focus on arrival only with a mouse: on a phone it would pop the keyboard over the page before the shopper reads it
  useEffect(() => { if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) input.current?.focus() }, [])

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); input.current?.focus() }
      if (event.key === "Escape" && busy) onStop()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [busy, onStop])

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); if (!busy) onSend() }
  }

  return (
    <div className="composer">
      <div className="composer-card squircle">
        {/* four beams in the logo colours travel around the card's edge */}
        <svg className="composer-beams" aria-hidden="true" preserveAspectRatio="none">
          {BEAMS.map((color, i) => <rect key={color} x="1" y="1" rx="27" ry="27" pathLength={100} stroke={color} style={{ animationDelay: `${i * -1.5}s` }} />)}
        </svg>
        <label className="sr-only" htmlFor="pregunta">{askLabel}</label>
        <textarea id="pregunta" ref={input} className="composer-input" rows={1} value={value} maxLength={MAX_QUESTION_LENGTH} enterKeyHint="search"
          placeholder="¿Qué estás buscando? Por ejemplo: regalo para niña de 6 años" onChange={(event) => onChange(event.target.value)} onKeyDown={onKeyDown} />
        <div className="composer-toolbar">
          <span className="composer-hint">{value.length > MAX_QUESTION_LENGTH - 40 ? `${value.length}/${MAX_QUESTION_LENGTH}` : <>Enter para buscar · <kbd>Ctrl</kbd> <kbd>K</kbd></>}</span>
          <button type="button" className="send-button" data-busy={busy} onClick={busy ? onStop : onSend} disabled={!busy && !value.trim()} aria-label={busy ? "Detener" : "Buscar"}>
            {busy ? <Stop size={16} weight="fill" aria-hidden="true" /> : <ArrowUp size={18} weight="bold" aria-hidden="true" />}
          </button>
        </div>
      </div>
    </div>
  )
}

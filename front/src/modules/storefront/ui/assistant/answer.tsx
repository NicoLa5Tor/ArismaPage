"use client"

import { useState } from "react"
import { motion, useReducedMotion } from "motion/react"
import { ArrowClockwise, Copy, ThumbsDown, ThumbsUp, WarningCircle, WhatsappLogo } from "@phosphor-icons/react"
import type { AssistantAnswer } from "../../domain/assistant"
import { ProductCard } from "../catalog/product-card"
import { useWhatsapp } from "../../../shared/ui/store-profile"

const ease = [0.23, 1, 0.32, 1] as const

/** The reply appears word by word, then the real products and the chips to refine the search. */
export function Answer({ answer, query, onAsk, onRetry }: { answer: AssistantAnswer; query: string; onAsk: (question: string) => void; onRetry: () => void }) {
  const whatsappUrl = useWhatsapp()
  const reduce = useReducedMotion()
  const words = answer.reply.split(/(\s+)/)
  const textDelay = reduce ? 0 : Math.min(words.length * 0.012, 0.6)
  const [vote, setVote] = useState<"up" | "down" | null>(null)
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    const lines = [answer.reply, ...answer.products.map((p) => `• ${p.title}`)]
    try { await navigator.clipboard.writeText(lines.join("\n")); setCopied(true); window.setTimeout(() => setCopied(false), 1400) } catch { /* clipboard blocked: nothing to do */ }
  }

  return (
    <div className="answer">
      <p className="answer-text">
        {words.map((word, index) => /^\s+$/.test(word) ? word : (
          <motion.span key={index} initial={reduce ? false : { opacity: 0, filter: "blur(3px)" }} animate={{ opacity: 1, filter: "blur(0px)" }} transition={{ duration: 0.35, delay: index * 0.012 }}>{word}</motion.span>
        ))}
      </p>
      {answer.source === "basic" && <p className="answer-note"><WarningCircle size={16} aria-hidden="true" /> Búsqueda simple: el buscador inteligente no está disponible en este momento.</p>}

      {answer.products.length > 0 ? (
        <div className="answer-grid">
          {answer.products.map((product, index) => (
            <motion.div key={product.id} initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease, delay: textDelay + index * 0.05 }}>
              <ProductCard product={product} index={0} />
            </motion.div>
          ))}
        </div>
      ) : answer.kind === "ask" ? null : answer.kind === "chat" ? answer.handoff && (
        <a className="answer-whatsapp squircle" href={whatsappUrl(`Hola, tengo una pregunta: ${query}`)} target="_blank" rel="noopener noreferrer"><WhatsappLogo size={18} weight="fill" aria-hidden="true" /> Hablar con un asesor</a>
      ) : (
        <a className="answer-whatsapp squircle" href={whatsappUrl(`Hola, busco: ${query}`)} target="_blank" rel="noopener noreferrer"><WhatsappLogo size={18} weight="fill" aria-hidden="true" /> Preguntar por WhatsApp</a>
      )}

      {answer.kind === "search" && <motion.div className="answer-actions" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: textDelay + 0.2 }}>
        <button type="button" onClick={copy} aria-label="Copiar respuesta" data-on={copied}><Copy size={16} aria-hidden="true" /></button>
        <button type="button" onClick={() => setVote(vote === "up" ? null : "up")} aria-label="Me sirvió" aria-pressed={vote === "up"}><ThumbsUp size={16} aria-hidden="true" /></button>
        <button type="button" onClick={() => setVote(vote === "down" ? null : "down")} aria-label="No me sirvió" aria-pressed={vote === "down"}><ThumbsDown size={16} aria-hidden="true" /></button>
        <button type="button" onClick={onRetry} aria-label="Buscar de nuevo"><ArrowClockwise size={16} aria-hidden="true" /></button>
      </motion.div>}

      {answer.suggestions.length > 0 && (
        <motion.div className="answer-chips" role="group" aria-label={answer.kind === "ask" ? "Opciones para responder" : "Sugerencias para seguir buscando"} initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: textDelay + 0.3, duration: 0.4, ease }}>
          {answer.suggestions.map((suggestion) => <button key={suggestion} type="button" className="ask-chip squircle" onClick={() => onAsk(suggestion)}>{suggestion}</button>)}
        </motion.div>
      )}
    </div>
  )
}

"use client"

import { loginUrl } from "../../../account/domain/account"
import { AccountButton } from "../../../account/ui/account-button"
import { useAccount } from "../../../account/ui/account-context"
import { CartButton } from "../../../cart/ui/cart-button"
import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { ArrowLeft, Plus, Sparkle } from "@phosphor-icons/react"
import type { AssistantPort } from "../../application/assistant-port"
import { type AssistantContext, type AssistantTurn, cleanQuestion } from "../../domain/assistant"
import { Answer } from "./answer"
import { Composer } from "./composer"
import { Orb } from "./orb"
import { ThoughtLine } from "./thought-line"
import { useStoreProfile } from "../../../shared/ui/store-profile"
import { BrandLink, useAskLabel } from "../store-brand"

const ease = [0.23, 1, 0.32, 1] as const
let sequence = 0
const nextId = () => `t${++sequence}`

/** "Pregúntale a Arisma": a search that reads like a conversation, answered with real products from the catalog. */
export function AssistantView({ port, initialQuestion = "" }: { port: AssistantPort; initialQuestion?: string }) {
  const profile = useStoreProfile(), askLabel = useAskLabel()
  const reduce = useReducedMotion()
  const account = useAccount()
  const signedOut = account.ready && !account.session
  const [turns, setTurns] = useState<AssistantTurn[]>([])
  const [draft, setDraft] = useState(initialQuestion)
  const [examples, setExamples] = useState<string[]>([])
  const controller = useRef<AbortController | null>(null)
  // what the search service understood so far; it goes back with every question so follow-ups build on it
  const context = useRef<AssistantContext | null>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const stick = useRef(true)
  const busy = turns.some((turn) => turn.role === "assistant" && turn.status === "thinking")

  useEffect(() => { port.suggestions().then(setExamples).catch(() => setExamples([])) }, [port])
  // follow the conversation, unless the shopper scrolled up to read something
  useEffect(() => {
    const el = scroller.current
    if (el && stick.current) el.scrollTo({ top: el.scrollHeight, behavior: reduce ? "auto" : "smooth" })
  }, [turns, reduce])

  const ask = useCallback(async (raw: string) => {
    const question = cleanQuestion(raw)
    if (!question || controller.current) return
    const id = nextId()
    stick.current = true
    setTurns((all) => [...all, { id: nextId(), role: "user", text: question }, { id, role: "assistant", query: question, status: "thinking" }])
    setDraft("")
    const abort = new AbortController()
    controller.current = abort
    const update = (patch: Partial<Extract<AssistantTurn, { role: "assistant" }>>) =>
      setTurns((all) => all.map((turn) => (turn.id === id && turn.role === "assistant" ? { ...turn, ...patch } : turn)))
    try {
      const answer = await port.ask(question, context.current, abort.signal)
      context.current = answer.context
      update({ status: "done", answer })
    } catch (error) {
      if (abort.signal.aborted) update({ status: "stopped" })
      else update({ status: "error", error: (error as Error).message })
    } finally {
      controller.current = null
    }
  }, [port])

  const stop = useCallback(() => controller.current?.abort(), [])
  const restart = () => { controller.current?.abort(); context.current = null; setTurns([]); setDraft("") }
  const retry = (query: string) => ask(query)
  const empty = turns.length === 0

  return (
    <main id="contenido" className="storefront assistant">
      <header className="assistant-header">
        <Link href="/productos" className="assistant-back" aria-label="Volver al catálogo"><ArrowLeft size={18} aria-hidden="true" /> <span>Catálogo</span></Link>
        {!empty && <button type="button" className="assistant-restart" onClick={restart} aria-label="Nueva búsqueda"><Plus size={16} weight="bold" aria-hidden="true" /> <span>Nueva búsqueda</span></button>}
        <AccountButton />
        <CartButton />
        <BrandLink className="assistant-brand" />
      </header>

      <div className="assistant-scroll" ref={scroller} onScroll={(event) => { const el = event.currentTarget; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120 }}>
        <div className="assistant-thread">
          <AnimatePresence>
            {empty && (
              <motion.section key="hero" className="assistant-hero" exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, filter: "blur(8px)" }} transition={{ duration: 0.4, ease }}>
                <Orb active={busy} />
                <motion.div className="assistant-hero-copy" initial={reduce ? false : { opacity: 0, y: 10, filter: "blur(6px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ duration: 1, ease, delay: 0.15 }}>
                  <h1>{askLabel}</h1>
                  <p>Cuéntanos para quién es, su edad o qué quiere aprender. Te mostramos los productos que encajan.</p>
                </motion.div>
              </motion.section>
            )}
          </AnimatePresence>

          {turns.map((turn) => turn.role === "user" ? (
            <motion.div key={turn.id} className="turn-user" initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease }}>
              <p className="bubble squircle">{turn.text}</p>
            </motion.div>
          ) : (
            <motion.div key={turn.id} className="turn-assistant" initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease }}>
              <span className="turn-avatar" aria-hidden="true"><Sparkle size={16} weight="fill" /></span>
              <div className="turn-body" aria-live="polite">
                <ThoughtLine working={turn.status === "thinking"} steps={turn.answer?.steps ?? []} />
                {turn.status === "done" && turn.answer && <Answer answer={turn.answer} query={turn.query} onAsk={ask} onRetry={() => retry(turn.query)} />}
                {turn.status === "error" && (
                  <div className="turn-error squircle">
                    <p>{turn.error}</p>
                    <button type="button" className="ask-chip squircle" onClick={() => retry(turn.query)}>Intentar de nuevo</button>
                  </div>
                )}
                {turn.status === "stopped" && <p className="turn-stopped">Búsqueda detenida.</p>}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="assistant-bottom">
        {empty && examples.length > 0 && (
          <div className="assistant-examples">
            {examples.map((example) => <button key={example} type="button" className="ask-chip squircle" onClick={() => (signedOut ? setDraft(example) : ask(example))}>{example}</button>)}
          </div>
        )}
        {signedOut ? (
          <div className="assistant-login squircle">
            <p>Entra con tu cuenta para hablar con el asistente. Es gratis y tu pregunta te espera al volver.</p>
            <Link href={`${loginUrl(draft ? `/buscar?q=${encodeURIComponent(draft)}` : "/buscar")}&motivo=asistente`} className="button-primary">Entrar o crear cuenta</Link>
          </div>
        ) : <Composer value={draft} onChange={setDraft} onSend={() => ask(draft)} onStop={stop} busy={busy} />}
        <p className="assistant-foot">Busca entre los productos publicados de {profile.shortName}. Para cotizar, cada producto te lleva a WhatsApp.</p>
      </div>
    </main>
  )
}
